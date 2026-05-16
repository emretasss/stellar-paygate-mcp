#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, IntoVal, String,
};

struct Fixture {
    env: Env,
    client: PayGateRegistryClient<'static>,
    token: Address,
    admin: Address,
    gateway: Address,
    provider: Address,
    payer: Address,
}

fn text(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let gateway = Address::generate(&env);
    let provider = Address::generate(&env);
    let payer = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token = asset.address();
    let stellar_asset = StellarAssetClient::new(&env, &token);
    stellar_asset.mint(&provider, &2_000);

    let contract_id = env.register(PayGateRegistry, ());
    let client = PayGateRegistryClient::new(&env, &contract_id);
    client.init(&admin, &token, &gateway, &250);

    Fixture {
        env,
        client,
        token,
        admin,
        gateway,
        provider,
        payer,
    }
}

fn register_default_tool(f: &Fixture) -> u32 {
    f.client
        .register_tool(
            &f.provider,
            &text(&f.env, "Invoice Risk Score"),
            &text(&f.env, "risk"),
            &10_000_000,
            &text(&f.env, "sha256:invoice-tool"),
            &250,
        )
}

#[test]
fn init_sets_config_once() {
    let f = fixture();

    let config = f.client.get_config();
    assert_eq!(config.admin, f.admin);
    assert_eq!(config.gateway, f.gateway);
    assert_eq!(config.fee_bps, 250);

    let second = f.client.try_init(&f.admin, &f.token, &f.gateway, &250);
    assert_eq!(second, Err(Ok(PayGateError::AlreadyInitialized)));
}

#[test]
fn register_tool_locks_provider_bond_and_updates_stats() {
    let f = fixture();
    let token = TokenClient::new(&f.env, &f.token);
    let before = token.balance(&f.provider);

    let tool_id = register_default_tool(&f);
    let tool = f.client.get_tool(&tool_id);
    let stats = f.client.provider_stats(&f.provider);

    assert_eq!(tool.id, 1);
    assert_eq!(tool.provider, f.provider);
    assert_eq!(tool.active, true);
    assert_eq!(stats.tools, 1);
    assert_eq!(stats.bonded, 250);
    assert_eq!(token.balance(&f.provider), before - 250);
    assert_eq!(token.balance(&f.client.address), 250);
}

#[test]
fn provider_can_disable_own_tool() {
    let f = fixture();
    let tool_id = register_default_tool(&f);

    f.client
        .set_tool_active(&f.provider, &tool_id, &false);

    let tool = f.client.get_tool(&tool_id);
    assert_eq!(tool.active, false);
}

#[test]
fn gateway_records_paid_call_and_stats() {
    let f = fixture();
    let tool_id = register_default_tool(&f);

    let call_id = f
        .client
        .record_call(
            &f.gateway,
            &tool_id,
            &f.payer,
            &10_000_000,
            &text(&f.env, "tx:testnet-hash"),
            &text(&f.env, "sha256:req"),
            &text(&f.env, "sha256:res"),
        );

    let call = f.client.get_call(&call_id);
    let stats = f.client.provider_stats(&f.provider);

    assert_eq!(call.id, 1);
    assert_eq!(call.status, CallStatus::Paid);
    assert_eq!(stats.calls, 1);
    assert_eq!(stats.volume, 10_000_000);
}

#[test]
fn non_gateway_cannot_record_paid_call() {
    let f = fixture();
    let tool_id = register_default_tool(&f);
    let attacker = Address::generate(&f.env);

    let result = f.client.try_record_call(
        &attacker,
        &tool_id,
        &f.payer,
        &10_000_000,
        &text(&f.env, "tx:testnet-hash"),
        &text(&f.env, "sha256:req"),
        &text(&f.env, "sha256:res"),
    );

    assert_eq!(result, Err(Ok(PayGateError::Unauthorized)));
}

#[test]
fn payer_opens_and_admin_resolves_dispute_with_refund() {
    let f = fixture();
    let token = TokenClient::new(&f.env, &f.token);
    let tool_id = register_default_tool(&f);
    let call_id = f
        .client
        .record_call(
            &f.gateway,
            &tool_id,
            &f.payer,
            &10_000_000,
            &text(&f.env, "tx:testnet-hash"),
            &text(&f.env, "sha256:req"),
            &text(&f.env, "sha256:res"),
        );

    f.client
        .open_dispute(&f.payer, &call_id, &text(&f.env, "sha256:reason"));

    let payer_before = token.balance(&f.payer);
    f.client
        .resolve_dispute(&f.admin, &call_id, &100);

    let call = f.client.get_call(&call_id);
    assert_eq!(call.status, CallStatus::Resolved);
    assert_eq!(token.balance(&f.payer), payer_before + 100);
    assert_eq!(token.balance(&f.client.address), 150);
}

#[test]
fn auth_shape_requires_provider_for_registration() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let gateway = Address::generate(&env);
    let provider = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin).address();
    let contract_id = env.register(PayGateRegistry, ());
    let client = PayGateRegistryClient::new(&env, &contract_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "init",
            args: (admin.clone(), token.clone(), gateway.clone(), 0u32).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.init(&admin, &token, &gateway, &0);

    env.mock_auths(&[MockAuth {
        address: &provider,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register_tool",
            args: (
                provider.clone(),
                text(&env, "Grant Fit Check"),
                text(&env, "analysis"),
                1_000_000i128,
                text(&env, "sha256:metadata"),
                0i128,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let id = client
        .register_tool(
            &provider,
            &text(&env, "Grant Fit Check"),
            &text(&env, "analysis"),
            &1_000_000,
            &text(&env, "sha256:metadata"),
            &0,
        );

    assert_eq!(id, 1);
}
