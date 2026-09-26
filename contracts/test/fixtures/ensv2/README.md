# Official ENSv2 integration fixtures

Creation bytecode and ABI from `ensdomains/contracts-v2`, pinned to the official Sepolia deployment revision `71a3b7339dbc55ab47667abdfe8303bac4f4c24e`.
Source: https://github.com/ensdomains/contracts-v2/tree/71a3b7339dbc55ab47667abdfe8303bac4f4c24e/contracts/deployments/sepolia

These are the real ENS registry, factory, resolver and Universal Resolver contracts, not authorization mocks. Tests deploy fresh instances locally; they do not claim a live Sepolia registration. JSON retains original artifact SHA-256 and commit for reproducibility. Their address field identifies the official Sepolia deployment, not local fixture addresses. License: MIT, ENS Labs Limited (included).
