// Perpl Exchange ABI subset — the calls, events and reverts Senryo's direct onchain path uses (D1).
// Source: github.com/PerplFoundation/dex-sdk crates/sdk/abi/dex/Exchange.json + Errors.abi.json @ rc_v1.1.7-203-g0e5902dd (MIT),
// copied entry-for-entry (names, types, order) — never hand-edited. Deployed proxy getContractVersion() = 1.7.5
// (read 2 Oct 2026), which emits only the V2 order/fill/position events listed here (dex-sdk state/version.rs).
export const perplExchangeAbi = [
  {
    "type": "function",
    "name": "createAccount",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "accountId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositCollateral",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawCollateral",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "execOrder",
    "inputs": [
      {
        "name": "orderDesc",
        "type": "tuple",
        "components": [
          {
            "name": "orderDescId",
            "type": "uint256"
          },
          {
            "name": "perpId",
            "type": "uint256"
          },
          {
            "name": "orderType",
            "type": "uint8"
          },
          {
            "name": "orderId",
            "type": "uint256"
          },
          {
            "name": "pricePNS",
            "type": "uint256"
          },
          {
            "name": "lotLNS",
            "type": "uint256"
          },
          {
            "name": "expiryBlock",
            "type": "uint256"
          },
          {
            "name": "postOnly",
            "type": "bool"
          },
          {
            "name": "fillOrKill",
            "type": "bool"
          },
          {
            "name": "immediateOrCancel",
            "type": "bool"
          },
          {
            "name": "maxMatches",
            "type": "uint256"
          },
          {
            "name": "leverageHdths",
            "type": "uint256"
          },
          {
            "name": "lastExecutionBlock",
            "type": "uint256"
          },
          {
            "name": "amountCNS",
            "type": "uint256"
          },
          {
            "name": "maxNegPnlCollatBPS",
            "type": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "signature",
        "type": "tuple",
        "components": [
          {
            "name": "perpId",
            "type": "uint256"
          },
          {
            "name": "orderId",
            "type": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAccountByAddr",
    "inputs": [
      {
        "name": "accountAddress",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "accountInfo",
        "type": "tuple",
        "components": [
          {
            "name": "accountId",
            "type": "uint256"
          },
          {
            "name": "balanceCNS",
            "type": "uint256"
          },
          {
            "name": "lockedBalanceCNS",
            "type": "uint256"
          },
          {
            "name": "frozen",
            "type": "uint8"
          },
          {
            "name": "accountAddr",
            "type": "address"
          },
          {
            "name": "positions",
            "type": "tuple",
            "components": [
              {
                "name": "bank1",
                "type": "uint256"
              },
              {
                "name": "bank2",
                "type": "uint256"
              },
              {
                "name": "bank3",
                "type": "uint256"
              },
              {
                "name": "bank4",
                "type": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPositionV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "positionInfo",
        "type": "tuple",
        "components": [
          {
            "name": "accountId",
            "type": "uint256"
          },
          {
            "name": "nextNodeId",
            "type": "uint256"
          },
          {
            "name": "prevNodeId",
            "type": "uint256"
          },
          {
            "name": "positionType",
            "type": "uint8"
          },
          {
            "name": "depositCNS",
            "type": "uint256"
          },
          {
            "name": "pricePNS",
            "type": "uint256"
          },
          {
            "name": "lotLNS",
            "type": "uint256"
          },
          {
            "name": "entryBlock",
            "type": "uint256"
          },
          {
            "name": "pnlCNS",
            "type": "int256"
          },
          {
            "name": "deltaPnlCNS",
            "type": "int256"
          },
          {
            "name": "premiumPnlCNS",
            "type": "int256"
          },
          {
            "name": "priceResiduePNSQ16",
            "type": "uint256"
          }
        ]
      },
      {
        "name": "markPricePNS",
        "type": "uint256"
      },
      {
        "name": "markPriceValid",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPerpetualInfo",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "perpetualInfo",
        "type": "tuple",
        "components": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "priceDecimals",
            "type": "uint256"
          },
          {
            "name": "lotDecimals",
            "type": "uint256"
          },
          {
            "name": "linkFeedId",
            "type": "bytes32"
          },
          {
            "name": "priceTolPer100K",
            "type": "uint256"
          },
          {
            "name": "marginTol",
            "type": "uint256"
          },
          {
            "name": "marginTolDecimals",
            "type": "uint256"
          },
          {
            "name": "refPriceMaxAgeSec",
            "type": "uint256"
          },
          {
            "name": "positionBalanceCNS",
            "type": "uint256"
          },
          {
            "name": "insuranceBalanceCNS",
            "type": "uint256"
          },
          {
            "name": "markPNS",
            "type": "uint256"
          },
          {
            "name": "markTimestamp",
            "type": "uint256"
          },
          {
            "name": "lastPNS",
            "type": "uint256"
          },
          {
            "name": "lastTimestamp",
            "type": "uint256"
          },
          {
            "name": "oraclePNS",
            "type": "uint256"
          },
          {
            "name": "oracleTimestampSec",
            "type": "uint256"
          },
          {
            "name": "longOpenInterestLNS",
            "type": "uint256"
          },
          {
            "name": "shortOpenInterestLNS",
            "type": "uint256"
          },
          {
            "name": "fundingStartBlock",
            "type": "uint256"
          },
          {
            "name": "fundingRatePct100k",
            "type": "int16"
          },
          {
            "name": "absFundingClampPctPer100K",
            "type": "uint256"
          },
          {
            "name": "status",
            "type": "uint8"
          },
          {
            "name": "basePricePNS",
            "type": "uint256"
          },
          {
            "name": "maxBidPriceONS",
            "type": "uint256"
          },
          {
            "name": "minBidPriceONS",
            "type": "uint256"
          },
          {
            "name": "maxAskPriceONS",
            "type": "uint256"
          },
          {
            "name": "minAskPriceONS",
            "type": "uint256"
          },
          {
            "name": "numOrders",
            "type": "uint256"
          },
          {
            "name": "ignOracle",
            "type": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getExchangeInfo",
    "inputs": [],
    "outputs": [
      {
        "name": "balanceCNS",
        "type": "uint256"
      },
      {
        "name": "protocolBalanceCNS",
        "type": "uint256"
      },
      {
        "name": "recycleBalanceCNS",
        "type": "uint256"
      },
      {
        "name": "collateralDecimals",
        "type": "uint256"
      },
      {
        "name": "collateralToken",
        "type": "address"
      },
      {
        "name": "verifierProxy",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMinAccountOpenCNS",
    "inputs": [],
    "outputs": [
      {
        "name": "minAccountOpenCNS",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarginFractions",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "lotLNS",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "perpInitMarginFracHdths",
        "type": "uint256"
      },
      {
        "name": "perpMaintMarginFracHdths",
        "type": "uint256"
      },
      {
        "name": "dynamicInitMarginFracHdths",
        "type": "uint256"
      },
      {
        "name": "oiMaxLNS",
        "type": "uint256"
      },
      {
        "name": "unityDescentThreshHdths",
        "type": "uint256"
      },
      {
        "name": "overColDescentThreshHdths",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTakerFee",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isHalted",
    "inputs": [],
    "outputs": [
      {
        "name": "halted",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getContractVersion",
    "inputs": [],
    "outputs": [
      {
        "name": "major",
        "type": "uint256"
      },
      {
        "name": "minor",
        "type": "uint256"
      },
      {
        "name": "patch",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getWithdrawAllowanceData",
    "inputs": [
      {
        "name": "blockNumber",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "allowanceCNS",
        "type": "uint256"
      },
      {
        "name": "expiryBlock",
        "type": "uint256"
      },
      {
        "name": "lastAllowanceBlock",
        "type": "uint256"
      },
      {
        "name": "cnsPerBlock",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AccountCreated",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": false
      },
      {
        "name": "id",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollateralDeposit",
    "inputs": [
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "balanceCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollateralWithdrawal",
    "inputs": [
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "balanceCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderRequestV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "orderDescId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "orderId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "orderType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "expiryBlock",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "postOnly",
        "type": "bool",
        "indexed": false
      },
      {
        "name": "fillOrKill",
        "type": "bool",
        "indexed": false
      },
      {
        "name": "immediateOrCancel",
        "type": "bool",
        "indexed": false
      },
      {
        "name": "maxMatches",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "leverageHdths",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lastExecutionBlock",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "maxNegPnlCollatBPS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "gasLeft",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "extension",
        "type": "bytes",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderBatchCompleted",
    "inputs": [
      {
        "name": "gasLeft",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TakerOrderFilledV2",
    "inputs": [
      {
        "name": "entryPricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "collatPricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pnlPricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "feeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "balanceCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "builderId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "builderFeeCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MakerOrderFilledV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "orderId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "feeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lockedBalanceCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "balanceCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "builderId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "builderFeeCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ImmediateOrCancelExecuted",
    "inputs": [
      {
        "name": "unmatchedLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "totalLotLNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MaxMatchesReached",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OrderPlaced",
    "inputs": [
      {
        "name": "orderId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lockedBalanceCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "amountCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "balanceCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionOpenedV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "positionType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "leverageHdths",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "depositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pnlCollateralizedCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "lotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "insFeeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "protFeeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "priceResiduePNSQ16",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionIncreasedV2",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "positionType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "leverageHdths",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "startDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pnlCollateralizedCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "premiumPnlSettledCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "maxNegPnlCollatBPS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "startLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "insFeeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "protFeeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "priceResiduePNSQ16",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionDecreased",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "positionType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "startDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "startLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "deltaPnlCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "fundingCNS",
        "type": "int256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionClosed",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "positionType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "deltaPnlCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "fundingCNS",
        "type": "int256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionInverted",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "accountId",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "positionType",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "leverageHdths",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "startDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endDepositCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "pnlCollateralizedCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "pricePNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "startLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "endLotLNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "deltaPnlCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "fundingCNS",
        "type": "int256",
        "indexed": false
      },
      {
        "name": "insFeeCNS",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "protFeeCNS",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccountDoesNotExist",
    "inputs": [
      {
        "name": "accountAddress",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "AccountExists",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "accountId",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "AccountFrozen",
    "inputs": [
      {
        "name": "status",
        "type": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "AddressBlocked",
    "inputs": [
      {
        "name": "addr",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "AmountExceedsAvailableBalance",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256"
      },
      {
        "name": "availableBalanceCNS",
        "type": "uint256"
      },
      {
        "name": "balanceCNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "CloseOrderExceedsPosition",
    "inputs": [
      {
        "name": "posLotLNS",
        "type": "uint256"
      },
      {
        "name": "orderLotLNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "CloseOrderPositionMismatch",
    "inputs": [
      {
        "name": "positionType",
        "type": "uint8"
      },
      {
        "name": "orderType",
        "type": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "ContractNotOperational",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "status",
        "type": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "ExceedsLastExecutionBlock",
    "inputs": [
      {
        "name": "lastExecutionBlock",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ExchangeHalted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ImmediateOrderUnderMinimum",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256"
      },
      {
        "name": "orderAmountCNS",
        "type": "uint256"
      },
      {
        "name": "minAmountCNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficentAmountToOpenAccount",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "amountCNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientFunds",
    "inputs": [
      {
        "name": "balanceCNS",
        "type": "uint256"
      },
      {
        "name": "amountCNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "LotOutOfRange",
    "inputs": [
      {
        "name": "lotLNS",
        "type": "uint256"
      },
      {
        "name": "minLotLNS",
        "type": "uint256"
      },
      {
        "name": "maxLotLNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MarkExceedsTol",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "markPNS",
        "type": "uint256"
      },
      {
        "name": "spotOraclePricePNS",
        "type": "uint256"
      },
      {
        "name": "tolerancePer100k",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "MarkPriceAgeExceedsMax",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "markTimestamp",
        "type": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "name": "maxAgeSec",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotWhitelisted",
    "inputs": [
      {
        "name": "addr",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OracleAgeExceedsMax",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "oracleTimestamp",
        "type": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "name": "maxAgeSec",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "OrderSizeExceedsAvailableSize",
    "inputs": [
      {
        "name": "orderLotLNS",
        "type": "uint256"
      },
      {
        "name": "availableLotLNS",
        "type": "uint256"
      },
      {
        "name": "positionLotLNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "PositionDoesNotExist",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "PriceOutOfRange",
    "inputs": [
      {
        "name": "pricePNS",
        "type": "uint256"
      },
      {
        "name": "minPricePNS",
        "type": "uint256"
      },
      {
        "name": "maxPricePNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "TakerOrderSettlementFailed",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256"
      },
      {
        "name": "entryPricePNS",
        "type": "uint256"
      },
      {
        "name": "collatPricePNS",
        "type": "uint256"
      },
      {
        "name": "pnlPricePNS",
        "type": "uint256"
      },
      {
        "name": "filledLotLNS",
        "type": "uint256"
      },
      {
        "name": "unfillableLotLNS",
        "type": "uint256"
      },
      {
        "name": "resultCode",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnmatchedLotRemainsInFillOrKill",
    "inputs": [
      {
        "name": "perpId",
        "type": "uint256"
      },
      {
        "name": "accountId",
        "type": "uint256"
      },
      {
        "name": "unmatchedLotLNS",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "WithdrawRateLimitExceeded",
    "inputs": [
      {
        "name": "amountCNS",
        "type": "uint256"
      },
      {
        "name": "allowanceCNS",
        "type": "uint256"
      },
      {
        "name": "amountPerBlockCNS",
        "type": "uint256"
      },
      {
        "name": "expiryBlock",
        "type": "uint256"
      }
    ]
  }
] as const;
