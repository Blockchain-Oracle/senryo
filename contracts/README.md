# Senryo contracts

Foundry project (outside the pnpm workspace). Spec: `docs/plan/specs/contracts.md` + `docs/plan/specs/risk-math.md`; plan `docs/plan/00-plan.md` §2.1.

```sh
git submodule update --init --recursive   # forge-std, OpenZeppelin v5.7.0
forge build
forge test --network monad                 # targeted invariant/fuzz suites only (D-018)
forge fmt --check && forge lint
```

Toolchain: forge 1.8.x, solc 0.8.31, `evm_version = "osaka"`, `network = "monad"` (Monad gas model, 128 KB code limit).
Rules: no magic numbers (constants only — invariant `sol-no-magic-numbers`), files ≤ 400 lines, never compare `block.timestamp` for equality.
