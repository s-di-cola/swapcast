#!/bin/bash
echo "v0.0.1" | npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 swapcast-subgraph
