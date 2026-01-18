#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Reconciliation Service Test Script${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Test 1: Check if server is running
echo -e "${YELLOW}Test 1: Checking server status...${NC}"
if curl -s "${BASE_URL}/" > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}\n"
else
    echo -e "${RED}✗ Server is not running. Please start the server first.${NC}"
    exit 1
fi

# Test 2: Get reconciliation status
echo -e "${YELLOW}Test 2: Getting reconciliation service status...${NC}"
STATUS=$(curl -s "${BASE_URL}/api/reconciliation/status")
echo "$STATUS" | jq .
echo ""

# Test 3: Trigger manual reconciliation check
echo -e "${YELLOW}Test 3: Triggering manual reconciliation check...${NC}"
CHECK_RESULT=$(curl -s -X POST "${BASE_URL}/api/reconciliation/check")
echo "$CHECK_RESULT" | jq .

# Parse result
IN_SYNC=$(echo "$CHECK_RESULT" | jq -r '.inSync')
MONGO_COUNT=$(echo "$CHECK_RESULT" | jq -r '.mongoCount')
OS_COUNT=$(echo "$CHECK_RESULT" | jq -r '.opensearchCount')
DIFFERENCE=$(echo "$CHECK_RESULT" | jq -r '.difference')
SYNCED=$(echo "$CHECK_RESULT" | jq -r '.synced')

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Results Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "MongoDB Count:    $MONGO_COUNT"
echo -e "OpenSearch Count: $OS_COUNT"
echo -e "Difference:       $DIFFERENCE"
echo -e "Documents Synced: $SYNCED"

if [ "$IN_SYNC" = "true" ]; then
    echo -e "${GREEN}Status:           ✓ In Sync${NC}"
else
    echo -e "${RED}Status:           ✗ Out of Sync${NC}"
fi

echo ""

# Test 4: Get updated status
echo -e "${YELLOW}Test 4: Getting updated status after check...${NC}"
UPDATED_STATUS=$(curl -s "${BASE_URL}/api/reconciliation/status")
echo "$UPDATED_STATUS" | jq .

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${GREEN}========================================${NC}"



