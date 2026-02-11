#!/bin/bash

# NdalamaHub LMS - Test Data Setup Script
# This script sets up all test data for frontend testing

echo "🌱 NdalamaHub LMS - Test Data Setup"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root directory"
    exit 1
fi

# Step 1: Seed companies and users
echo "📦 Step 1/2: Creating companies and users..."
echo ""
cd server
pnpm run seed

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to seed companies and users"
    exit 1
fi

echo ""
echo "✅ Companies and users created"
echo ""

# Step 2: Seed loan products
echo "💰 Step 2/2: Creating loan products..."
echo ""
node utils/seedProducts.js

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to seed loan products"
    exit 1
fi

cd ..

echo ""
echo "✅ Test data setup complete!"
echo ""
echo "📋 Summary:"
echo "  - 2 Lender Companies (FirstBank, QuickCash)"
echo "  - 3 Corporate Companies (TechCorp, Mining Corp, RetailMart)"
echo "  - 11 Users (across all roles)"
echo "  - 14 Loan Products (7 types × 2 lenders)"
echo ""
echo "🔑 Quick Login Credentials:"
echo "  Super User:      superadmin / Admin@2025"
echo "  Lender Admin:    manager / Manager@2025"
echo "  Corporate HR:    hr_sarah / HR@2025"
echo "  Corporate Admin: david_admin / Corporate@2025"
echo "  Employee:        john_employee / Employee@2025"
echo ""
echo "🚀 Next Steps:"
echo "  1. Start the application:"
echo "     pnpm start"
echo ""
echo "  2. Open your browser:"
echo "     http://localhost:5173"
echo ""
echo "  3. Follow the test plan:"
echo "     FRONTEND_TEST_PLAN.md"
echo ""
