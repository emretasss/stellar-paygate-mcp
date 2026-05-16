#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    token::Client as TokenClient, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub gateway: Address,
    pub fee_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolRecord {
    pub id: u32,
    pub provider: Address,
    pub name: String,
    pub category: String,
    pub price: i128,
    pub metadata_hash: String,
    pub bond_amount: i128,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CallRecord {
    pub id: u32,
    pub tool_id: u32,
    pub payer: Address,
    pub amount: i128,
    pub payment_tx_hash: String,
    pub request_hash: String,
    pub response_hash: String,
    pub status: CallStatus,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CallStatus {
    Paid,
    Disputed,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderStats {
    pub tools: u32,
    pub calls: u32,
    pub volume: i128,
    pub bonded: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    ToolSeq,
    CallSeq,
    Tool(u32),
    Call(u32),
    ProviderStats(Address),
    DisputeReason(u32),
}

#[contractevent(topics = ["init"])]
pub struct InitializedEvent {
    pub admin: Address,
    pub gateway: Address,
    pub fee_bps: u32,
}

#[contractevent(topics = ["tool"])]
pub struct ToolRegisteredEvent {
    pub provider: Address,
    pub tool_id: u32,
    pub price: i128,
}

#[contractevent(topics = ["active"])]
pub struct ToolActiveEvent {
    pub provider: Address,
    pub tool_id: u32,
    pub active: bool,
}

#[contractevent(topics = ["paid"])]
pub struct PaidCallEvent {
    pub provider: Address,
    pub call_id: u32,
    pub tool_id: u32,
    pub amount: i128,
}

#[contractevent(topics = ["dispute"])]
pub struct DisputeOpenedEvent {
    pub payer: Address,
    pub call_id: u32,
}

#[contractevent(topics = ["resolve"])]
pub struct DisputeResolvedEvent {
    pub admin: Address,
    pub call_id: u32,
    pub refund_amount: i128,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PayGateError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InvalidFee = 5,
    MissingTool = 6,
    InactiveTool = 7,
    MissingCall = 8,
    InvalidStatus = 9,
}

#[contract]
pub struct PayGateRegistry;

#[contractimpl]
impl PayGateRegistry {
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        gateway: Address,
        fee_bps: u32,
    ) -> Result<(), PayGateError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(PayGateError::AlreadyInitialized);
        }
        if fee_bps > 10_000 {
            return Err(PayGateError::InvalidFee);
        }

        admin.require_auth();

        let config = Config {
            admin: admin.clone(),
            token,
            gateway: gateway.clone(),
            fee_bps,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::ToolSeq, &0u32);
        env.storage().instance().set(&DataKey::CallSeq, &0u32);
        env.storage().instance().extend_ttl(100, 518_400);

        InitializedEvent {
            admin,
            gateway,
            fee_bps: config.fee_bps,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<Config, PayGateError> {
        read_config(&env)
    }

    pub fn register_tool(
        env: Env,
        provider: Address,
        name: String,
        category: String,
        price: i128,
        metadata_hash: String,
        bond_amount: i128,
    ) -> Result<u32, PayGateError> {
        if price <= 0 || bond_amount < 0 {
            return Err(PayGateError::InvalidAmount);
        }

        provider.require_auth();

        let config = read_config(&env)?;
        if bond_amount > 0 {
            let token = TokenClient::new(&env, &config.token);
            token.transfer(&provider, &env.current_contract_address(), &bond_amount);
        }

        let id = next_u32(&env, DataKey::ToolSeq);
        let tool = ToolRecord {
            id,
            provider: provider.clone(),
            name,
            category,
            price,
            metadata_hash,
            bond_amount,
            active: true,
        };

        env.storage().persistent().set(&DataKey::Tool(id), &tool);
        update_provider_stats(&env, &provider, 1, 0, 0, bond_amount);
        ToolRegisteredEvent {
            provider,
            tool_id: id,
            price: tool.price,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn set_tool_active(
        env: Env,
        provider: Address,
        tool_id: u32,
        active: bool,
    ) -> Result<(), PayGateError> {
        provider.require_auth();

        let mut tool = read_tool(&env, tool_id)?;
        if tool.provider != provider {
            return Err(PayGateError::Unauthorized);
        }

        tool.active = active;
        env.storage()
            .persistent()
            .set(&DataKey::Tool(tool_id), &tool);
        ToolActiveEvent {
            provider,
            tool_id,
            active,
        }
        .publish(&env);
        Ok(())
    }

    pub fn record_call(
        env: Env,
        gateway: Address,
        tool_id: u32,
        payer: Address,
        amount: i128,
        payment_tx_hash: String,
        request_hash: String,
        response_hash: String,
    ) -> Result<u32, PayGateError> {
        if amount <= 0 {
            return Err(PayGateError::InvalidAmount);
        }

        let config = read_config(&env)?;
        if config.gateway != gateway {
            return Err(PayGateError::Unauthorized);
        }
        gateway.require_auth();

        let tool = read_tool(&env, tool_id)?;
        if !tool.active {
            return Err(PayGateError::InactiveTool);
        }

        let id = next_u32(&env, DataKey::CallSeq);
        let call = CallRecord {
            id,
            tool_id,
            payer: payer.clone(),
            amount,
            payment_tx_hash,
            request_hash,
            response_hash,
            status: CallStatus::Paid,
        };

        env.storage().persistent().set(&DataKey::Call(id), &call);
        update_provider_stats(&env, &tool.provider, 0, 1, amount, 0);
        PaidCallEvent {
            provider: tool.provider,
            call_id: id,
            tool_id,
            amount,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn open_dispute(
        env: Env,
        payer: Address,
        call_id: u32,
        reason_hash: String,
    ) -> Result<(), PayGateError> {
        payer.require_auth();

        let mut call = read_call(&env, call_id)?;
        if call.payer != payer {
            return Err(PayGateError::Unauthorized);
        }
        if call.status != CallStatus::Paid {
            return Err(PayGateError::InvalidStatus);
        }

        call.status = CallStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Call(call_id), &call);
        env.storage()
            .persistent()
            .set(&DataKey::DisputeReason(call_id), &reason_hash);
        DisputeOpenedEvent { payer, call_id }.publish(&env);
        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        admin: Address,
        call_id: u32,
        refund_amount: i128,
    ) -> Result<(), PayGateError> {
        if refund_amount < 0 {
            return Err(PayGateError::InvalidAmount);
        }

        let config = read_config(&env)?;
        if config.admin != admin {
            return Err(PayGateError::Unauthorized);
        }
        admin.require_auth();

        let mut call = read_call(&env, call_id)?;
        if call.status != CallStatus::Disputed {
            return Err(PayGateError::InvalidStatus);
        }

        if refund_amount > 0 {
            let token = TokenClient::new(&env, &config.token);
            token.transfer(
                &env.current_contract_address(),
                &call.payer,
                &refund_amount,
            );
        }

        call.status = CallStatus::Resolved;
        env.storage()
            .persistent()
            .set(&DataKey::Call(call_id), &call);
        DisputeResolvedEvent {
            admin,
            call_id,
            refund_amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_tool(env: Env, tool_id: u32) -> Result<ToolRecord, PayGateError> {
        read_tool(&env, tool_id)
    }

    pub fn get_call(env: Env, call_id: u32) -> Result<CallRecord, PayGateError> {
        read_call(&env, call_id)
    }

    pub fn provider_stats(env: Env, provider: Address) -> ProviderStats {
        env.storage()
            .persistent()
            .get(&DataKey::ProviderStats(provider))
            .unwrap_or(ProviderStats {
                tools: 0,
                calls: 0,
                volume: 0,
                bonded: 0,
            })
    }
}

fn read_config(env: &Env) -> Result<Config, PayGateError> {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(PayGateError::NotInitialized)
}

fn read_tool(env: &Env, tool_id: u32) -> Result<ToolRecord, PayGateError> {
    env.storage()
        .persistent()
        .get(&DataKey::Tool(tool_id))
        .ok_or(PayGateError::MissingTool)
}

fn read_call(env: &Env, call_id: u32) -> Result<CallRecord, PayGateError> {
    env.storage()
        .persistent()
        .get(&DataKey::Call(call_id))
        .ok_or(PayGateError::MissingCall)
}

fn next_u32(env: &Env, key: DataKey) -> u32 {
    let current: u32 = env.storage().instance().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&key, &next);
    env.storage().instance().extend_ttl(100, 518_400);
    next
}

fn update_provider_stats(
    env: &Env,
    provider: &Address,
    tools_delta: u32,
    calls_delta: u32,
    volume_delta: i128,
    bonded_delta: i128,
) {
    let key = DataKey::ProviderStats(provider.clone());
    let mut stats: ProviderStats = env.storage().persistent().get(&key).unwrap_or(ProviderStats {
        tools: 0,
        calls: 0,
        volume: 0,
        bonded: 0,
    });
    stats.tools += tools_delta;
    stats.calls += calls_delta;
    stats.volume += volume_delta;
    stats.bonded += bonded_delta;
    env.storage().persistent().set(&key, &stats);
}

mod test;
