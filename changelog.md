# 2026-02-15
- Added full backend support for loan grace period and moratorium logic (principal-only and full moratorium)
- Repayment schedule now includes isGrace, isMoratorium, and graceType fields
- All grace/moratorium scenarios are covered by automated tests
- Schema updated for robust multi-tenant and legacy compatibility
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: For changes prior to February 2026, see [changelog_to_feb_2026.md](./changelog_to_feb_2026.md)

## [Unreleased]

### Changed
- **Frontend Test Plan Progress** (February 15, 2026):
  - Checked off all items for scenarios 1 through 5.2 in the test completion checklist.

### Added
- **Dashboard Portfolio Metrics Enhancements** (February 15, 2026):
  - Lender dashboard now displays Outstanding Balance and Total Interest Earned for the lender's portfolio.
  - Corporate admin/HR dashboard now displays Outstanding Balance and Total Interest Earned for the company's loans.
  - Metrics update live as portfolio changes.

### Added
- **Loan Application Form Enhancements** (February 12, 2026):
  - Payment schedule preview now working correctly
    - Fixed API endpoint to manually build schedules using available calculator functions
    - Removed calls to non-existent schedule generation functions
    - All 4 calculation methods now properly implemented:
      - reducing_balance: Manual loop with calculateMonthlyPayment() + calculatePeriodInterest()
      - flat_rate: Calculate total interest upfront, divide equally
      - simple_interest: Period-by-period interest calculation
      - interest_only: Monthly interest payments + balloon principal
    - Real-time schedule display with monthly payment, total repayment, total interest
    - First 3 installments table showing principal/interest breakdown
    - Debounced 500ms API calls to avoid excessive requests
  - Collateral section now always visible
    - Changed from conditional to always-shown for all products
    - Shows "(Optional)" label when not required by product
    - Shows red asterisk (*) when required by product
    - Allows optional collateral submission even for products that don't require it
  - Fixed term dropdown for short-term loans
    - Shows all available terms for products with max ≤ 12 months
    - Maintains 6-month intervals for long-term loans (> 12 months max)
    - Payday Loans now correctly show 1, 2, 3 months options
    - Bridge Loans show all monthly increments from 3-12
  - Fixed Payday Loan product configuration
    - Updated interest rate: 7% → 84% APR (7% per month equivalent)
    - Changed processing fee: Fixed K50 → 5% percentage-based
    - Now correctly calculates: K3,000 × 84% × 3/12 = K630 interest
    - Processing fee: K3,000 × 5% = K150
    - Monthly payment: K1,210, Total repayment: K3,630 (matches test plan)
  - Fixed validation bugs
    - Removed incorrect isAmountValid function check (was checking existence, not calling)
    - Removed duplicate useEffect for payment schedule fetching
    - Amount validation now works correctly for all loan amounts

- **Loan Disbursement Workflow** (February 12, 2026):
  - Added comprehensive disbursement form with notes field
    - Replaced simple "Disburse Loan" button with full form UI
    - Required disbursement notes field for audit trail (e.g., "Funds transferred to account ending 1234")
    - Blue-themed Card matching approval (green) and rejection (red) form patterns
    - Confirm/Cancel buttons with proper validation and state management
  - Added disbursement summary display
    - Shows principal amount, processing fee, and net disbursement
    - Calculates net amount customer receives: Amount - Processing Fee
    - Example: K50,000 - K2,000 fee = K48,000 net disbursement
    - Provides transparency before disbursement confirmation
  - Updated "Disburse Loan" button behavior
    - Now toggles disbursement form instead of direct action
    - Only shows when approval/rejection/disbursement forms are hidden
    - Maintains consistent UX across all loan actions

- **Loan Schema Processing Fees** (February 12, 2026):
  - Added `fees` field to Loan schema
    - Structure: `{ processing: Number, insurance: Number }`
    - Stores calculated fees from product configuration at loan creation
    - Min validation: 0 (fees cannot be negative)
  - Added virtual fields for easy access
    - `processingFee`: Returns `fees.processing` or 0
    - `insuranceFee`: Returns `fees.insurance` or 0
    - `totalUpfrontFees`: Sum of processing + insurance fees
    - `netDisbursement`: Loan amount minus total upfront fees
  - Enabled virtuals in JSON/Object output
    - `toJSON: { virtuals: true }`
    - `toObject: { virtuals: true }`
    - Ensures virtual fields are included in API responses
  - Created utility scripts for fee population
    - `utils/updateLoanFees.js`: Updates existing loans with product-calculated fees
    - `utils/fixTestLoans.js`: Links test loans to correct products and populates fees
    - Example: Bridge Loan K50,000 × 4% = K2,000 processing fee

### Fixed
- **Bridge Loan Product Configuration** (February 12, 2026):
  - Corrected calculation method: interest_only → simple_interest
  - Updated processing fee: 2.5% → 4% (K50,000 loan = K2,000 fee)
  - Removed insurance fee: 1.5% required → 0% (not needed for bridge loans)
  - Fixed simple_interest calculation in API endpoint:
    - Formula: totalInterest = amount × (rate/100) × (term/12)
    - Monthly payment: (amount + totalInterest) / term
    - Example: K50,000 @ 24% for 6 months = K6,000 interest, K9,333.33 monthly
  - Test results now match expected: K56,000 total repayment

- **Education Loan Product Configuration** (February 12, 2026):
  - Corrected calculation method: simple_interest → interest_only
  - Updated processing fee: 1% → 1.5% (K40,000 loan = K600 fee)
  - Removed insurance fee: 0.5% optional → 0% (not applicable)
  - Fixed interest_only calculation in API endpoint:
    - **Critical Bug**: Function call `calculateInterestOnlyPayment(amount, interestRate)` had parameter mismatch
      - Function expects 5 params: (principal, annualRate, term, frequency, accrualBasis)
      - Was called with only 2 params
      - Function returns object {interestPayment, totalInterest, balloonPayment, finalPayment}
      - Code treated return value as number, causing undefined/NaN cascade
    - **Solution**: Replaced with direct formula: `monthlyInterest = (amount × (interestRate / 100)) / 12`
    - Now correctly calculates:
      - K40,000 @ 14% for 24 months = K466.67 monthly interest
      - 23 payments of K466.67 (interest only)
      - 1 final payment of K40,466.67 (interest + full principal balloon)
      - Total interest: K11,200, Total repayment: K51,200
  - Payment schedule preview now displays correctly (was showing all N/A values)
  - Balloon payment structure properly represented in schedule

- **Frontend Testing & Product Management Enhancements**:
  - Created complete product CRUD dialogs
    - CreateProductDialog: Comprehensive form with all LoanProduct schema fields (450+ lines)
      - Basic info: name, description, category, status
      - Interest rates: min/max/default with percentage inputs
      - Loan amounts and terms: min/max/default configurations
      - Calculation method: reducing_balance, flat_rate, simple_interest, interest_only
      - Day count convention: actual/365, actual/360, 30/360
      - Fees: Processing fee (with type and amount), Insurance fee (with required checkbox)
      - Repayment frequency: Multi-select checkboxes (monthly, weekly, bi-weekly, quarterly, annually)
      - Collateral requirements: Checkbox with types selection (property, vehicle, equipment, inventory, securities, guarantor, other)
      - Grace period: Allowed checkbox with max months and interest treatment options
      - Prepayment settings: Allowed checkbox with penalty toggle and rate input
      - Eligibility criteria: Age range, income, credit score, employment months, employment types
    - EditProductDialog: Pre-filled edit form with same comprehensive fields (400+ lines)
    - Both dialogs submit to backend with full validation and error handling
  - Enhanced ProductsPage with full CRUD functionality
    - Create button: Opens CreateProductDialog with onClick handler
    - Edit button: Opens EditProductDialog with selected product data
    - Delete button: Confirmation prompt with API call to DELETE endpoint
    - Auto-refresh product list after create/update/delete operations
  - Fixed authorization middleware bug (CRITICAL FIX)
    - Updated `authorize()` middleware to handle both calling patterns:
      - `authorize('role1', 'role2')` - rest parameters pattern
      - `authorize(['role1', 'role2'])` - array pattern
    - Used `roles.flat()` to normalize both patterns to flat array
    - Resolves "Access denied. Insufficient permissions" error for lender_admin users
    - Now allows both patterns across all route files without breaking authorization
  - Product management now fully operational for lender_admin role
    - james_admin (QuickCash lender) can create, edit, delete products
    - Proper multi-tenant isolation maintained
    - Role-based access control working correctly

- **Frontend Testing & Navigation Enhancements**:
  - Added Products navigation menu to main navbar
    - Created ProductsPage component with category filtering
    - Dynamic product cards showing interest rates, amount ranges, and terms
    - Calculation method badges (reducing_balance, flat_rate, simple_interest, interest_only)
    - Company name badges on each product for multi-tenant clarity
  - Implemented lender filtering for product management (super_user only)
    - Dynamic lender dropdown populated from companies API
    - Backend support for company query parameter filtering
    - Real-time product filtering by both category and lender
    - Scalable solution for managing hundreds of products across multiple lenders
  - Created comprehensive test data seeding
    - Updated seeder.js with 11 users across all roles
    - 5 companies: 2 lenders (FirstBank, QuickCash), 3 corporates (TechCorp, Mining Corp, RetailMart)
    - 14 loan products seeded via seedProducts.js (7 types × 2 lenders)
    - Automated setup script (setup-test-data.sh) for one-command initialization
  - Created FRONTEND_TEST_PLAN.md (1,300+ lines)
    - Complete step-by-step testing guide with dummy data
    - 7 test parts: Setup, Products, Loan Lifecycle, Prepayments, Reports, Edge Cases, Performance
    - All 4 calculation methods covered with specific test scenarios
    - Login credentials quick reference table
    - Expected results for all test cases
    - Troubleshooting guide included
  - **Frontend Test Results**: Part 2 (Product Management) ✅ PASSED
    - Scenario 2.1: Browse products by category - PASSED
    - Scenario 2.2: Create custom product - PASSED
    - Scenario 2.3: Edit product configuration - PASSED
    - Scenario 2.4: Product filtering by lender - PASSED
    - Scenario 2.5: Product eligibility preview - PASSED
    - All CRUD operations working for lender_admin role

- **Phase 0: Loan Engine Enhancement - Week 4 ✅ COMPLETED**:
  - Built Prepayment & Early Settlement Engine (`server/models/Loan.js` extended, 600+ lines total)
    - Prepayment schema: Tracks amount, allocation strategy (reduce_term/reduce_payment), principal/interest/fee portions
    - Early settlement object: Records settlement date, amounts, fees, savings realized
    - Validation methods: `canAcceptPrepayment()`, `calculateRemainingBalance()`, `calculateAccruedInterest()`
    - Settlement calculation: `calculateEarlySettlementAmount()` with full breakdown and fees
    - Prepayment recording: `recordPrepayment()` with interest-first allocation strategy
    - Schedule recalculation: `recalculateSchedule()` supporting both reduce_term and reduce_payment strategies
    - Method-specific recalculation: 4 separate functions for reducing_balance, flat_rate, simple_interest, interest_only
  - Extended Loans API (`server/routes/loans.js`, 4 new endpoints)
    - `GET /api/loans/:id/settlement-quote`: Returns early settlement breakdown (read-only)
    - `POST /api/loans/:id/prepayment`: Records prepayment, triggers auto-recalculation, returns before/after summary
    - `POST /api/loans/:id/early-settlement`: Processes full payoff, marks loan completed
    - `GET /api/loans/:id/prepayment-history`: Lists all prepayments with summary totals
    - Authorization: lender_admin only for all prepayment operations
    - Multi-tenant validation: Checks lenderCompany match for security
  - Created comprehensive test suite (`server/utils/__tests__/`, 41 new tests)
    - `prepayment.test.js`: 19 tests for validation, balance calculation, settlement, recording
    - `prepaymentAPI.test.js`: 20 tests for API endpoints, authorization, multi-tenant isolation
    - `scheduleRecalculation.test.js`: 12 tests for both strategies across all 4 calculation methods
    - All 130 tests passing ✅ (99 + 41 new tests)
  - Built frontend prepayment components
    - PrepaymentDialog: Recording prepayments with strategy selection (308 lines)
    - PrepaymentHistoryDialog: Audit trail viewer with summary cards (233 lines)
    - Integrated into LoanDetailsDialog with action buttons
    - Added UI components: radio-group, textarea, alert (shadcn/ui compatible)
    - Installed @radix-ui/react-radio-group dependency
    - Frontend build successful ✅

- **Phase 0: Loan Engine Enhancement - Week 3 ✅ COMPLETED**:
  - Created comprehensive LoanProduct model (`server/models/LoanProduct.js`, 400+ lines)
    - 9 product categories: personal, business, payday, bridge, microfinance, auto, education, mortgage, other
    - Flexible configuration: interest rate ranges, term ranges, amount ranges
    - Support for all 4 calculation methods (reducing_balance, flat_rate, simple_interest, interest_only)
    - Fee structure: processing (percentage/fixed), insurance (optional), late payment, early settlement
    - Eligibility criteria: age range, minimum income, employment duration, credit score, employment types
    - Validation methods: `isAmountValid()`, `isTermValid()`, `isRateValid()`
    - Fee calculations: `calculateProcessingFee()`, `calculateInsuranceFee()`, `calculateUpfrontFees()`
    - Eligibility checking: `checkEligibility()` with detailed error messages
  - Built Products API (`server/routes/products.js`, 350+ lines, 10 endpoints)
    - Public endpoints: List products, get product, filter by category, check eligibility, calculate fees
    - Admin endpoints: Create, update, delete products, get statistics
    - Multi-tenant isolation: All queries filtered by company
  - Created product seeder (`server/utils/seedProducts.js`, 250+ lines)
    - 7 default product templates: Personal 18%, Business 22%, Payday 7%, Bridge 24%, Microfinance 28%, Auto 18%, Education 14%
    - Automatically seeds products for each lender company
    - Successfully tested with 7 products for 1 lender
  - Integrated products with loan application
    - Enhanced `server/routes/loans.js` with product-based loan creation
    - Added product reference field to Loan model
    - Automatic fee calculation from product configuration
    - Validation against product limits (amount, term, rate)
    - Backward compatible with legacy loans (without products)
  - Created frontend product components
    - ProductSelector: Grid-based product browser with category filtering (180+ lines)
    - ProductBasedLoanForm: 2-step wizard with real-time fee calculation (350+ lines)
    - ProductComparison: Side-by-side comparison for up to 4 products (450+ lines)
    - Badge component: For product categories and status indicators
  - Created comprehensive test suite (`server/utils/__tests__/loanProduct.test.js`, 280+ lines)
    - 28 tests covering all product functionality
    - Test suites: Validation Logic, Fee Calculations, Eligibility Checks, Interest Methods, Product Categories
    - All 28 tests passing ✅
  - Created comprehensive documentation (`WEEK_3_PRODUCT_CATALOG.md`)
    - Complete API endpoint reference with examples
    - Product configuration guide
    - Integration examples for loan applications
    - Fee calculation examples
    - Eligibility checking guide

- **Phase 0: Loan Engine Enhancement - Week 1, Day 1 ✅ COMPLETED**:
  - Added interest calculation configuration to Loan schema
  - Added `interestCalculation` object with method, accrualBasis, and accrualFrequency fields
  - Added `repaymentFrequency` field supporting weekly, bi-weekly, monthly, and quarterly schedules
  - Support for multiple amortization methods: reducing_balance, flat_rate, simple_interest, interest_only
  - Support for day count conventions: actual/365, actual/360, 30/360
  - Prepares foundation for daily interest accrual implementation
  - Created MongoDB Atlas connection for ndalamahub-prod database
  - Fixed password reset utility to properly hash passwords using pre-save hook
  - Environment configuration completed with .env file setup

- **Phase 0: Loan Engine Enhancement - Week 1, Day 2 ✅ COMPLETED**:
  - Created comprehensive interest calculator utility (`server/utils/interestCalculator.js`)
  - Implemented daily interest rate calculations for all three day count conventions
  - Added functions for calculating days between dates (actual and 30/360)
  - Built period interest calculator with accurate date handling
  - Created date manipulation utilities (addMonths, addDays, addWeeks)
  - Implemented payment frequency helpers (weekly, bi-weekly, monthly, quarterly)
  - Added 30 comprehensive unit tests with Jest - all passing ✅
  - Created manual test script demonstrating real-world calculations
  - Configured Jest testing framework for server-side tests

- **Phase 0: Loan Engine Enhancement - Week 1, Day 3 ✅ COMPLETED**:
  - Integrated interest calculator into Loan model
  - Updated `calculateLoanDetails()` method to use daily interest accrual
  - Updated `generateRepaymentSchedule()` method with actual day calculations
  - Replaced fixed 30-day month assumption with accurate date calculations
  - Interest now varies by actual days in month (28-31 days)
  - February payments now have correctly lower interest than 31-day months
  - Support for bi-weekly, weekly, and other payment frequencies fully functional
  - Created comprehensive test script demonstrating new calculations
  - Verified calculations with real loan scenarios

- **Phase 0: Loan Engine Enhancement - Week 1, Days 4-5 ✅ COMPLETED**:
  - Implemented flat rate amortization method for Zambian microfinance market
  - Added `calculateFlatRateInterest()` function to interest calculator utility
  - Added `calculateFlatRatePayment()` function returning monthly payment and total interest
  - Modified `calculateLoanDetails()` to detect and handle flat_rate method
  - Created `generateFlatRateSchedule()` method with equal principal/interest per installment
  - Split schedule generation into method-specific functions (flat_rate vs reducing_balance)
  - Created comparison test demonstrating 68.65% higher interest cost for flat rate
  - Verified flat rate calculations: ZMW 10,000 @ 24% for 6 months = ZMW 1,200 total interest
  - Test confirms flat rate charges interest on full principal throughout entire loan term
  - Successfully tested both methods side-by-side with identical loan parameters

- **Phase 0: Loan Engine Enhancement - Week 1, Days 6-7 ✅ COMPLETED**:
  - Created comprehensive loan calculation test suite (14 tests)
  - Added integration tests for reducing balance method (4 tests)
  - Added integration tests for flat rate method (3 tests)
  - Added day count convention tests (2 tests)
  - Added edge case tests covering zero interest, single payment, large amounts, long terms (4 tests)
  - Added February interest calculation validation test
  - All 44 tests passing (30 interest calculator + 14 loan calculations)
  - Installed mongodb-memory-server for future database testing needs
  - Created comprehensive loan engine documentation (LOAN_ENGINE_DOCUMENTATION.md)
  - Documented all features: daily accrual, day count conventions, flat rate, payment frequencies
  - Added API usage examples and migration guide
  - Documented schema changes and utility functions
  - Included performance considerations and known limitations
  - Added roadmap for Weeks 2-12 implementation plan

**Week 1 Summary**: Complete foundation for enterprise-grade loan calculations implemented and tested. Daily interest accrual with accurate date handling replaces fixed 30-day assumptions. Flat rate method added for microfinance market. 44/44 tests passing. Full documentation created.

- **Phase 0: Loan Engine Enhancement - Week 2, Days 1-2 ✅ COMPLETED**:
  - Implemented simple interest amortization method
  - Added `calculateSimpleInterest()` and `calculateSimpleInterestPayment()` functions
  - Simple interest calculates interest on original principal per period (not declining balance)
  - Interest varies by actual days in month, unlike flat rate's equal division
  - Added simple_interest handling in `calculateLoanDetails()` method
  - Created `generateSimpleInterestSchedule()` method with accurate period calculations
  - Added 4 comprehensive tests for simple interest method
  - Test validates variable interest based on actual days per period
  - Comparison shows simple interest between reducing balance and flat rate costs
  - Created testSimpleInterest.js demo comparing all three methods
  - All 48/48 tests passing (30 calculator + 18 loan calculations)

- **Phase 0: Loan Engine Enhancement - Week 2, Days 3-4 ✅ COMPLETED**:
  - Implemented interest-only amortization method with balloon payment support
  - Added `calculateInterestOnlyPayment()` function to interest calculator
  - Interest-only loans pay interest each period, principal due at maturity
  - Added interest_only handling in `calculateLoanDetails()` method
  - Created `generateInterestOnlySchedule()` method with balloon payment flag
  - Added `isBalloonPayment` field to repayment schedule schema
  - Added 4 comprehensive tests for interest-only loans
  - Tests validate balloon payment structure and lower regular payments
  - Comparison: Interest-only 79.71% more expensive than reducing balance but preserves capital
  - Created testInterestOnly.js demo showing use cases (bridge financing, investment properties)
  - All 52/52 tests passing (30 calculator + 22 loan calculations)

**Week 2 Summary**: Extended loan engine with simple interest and interest-only methods. Simple interest charges interest on original principal per period with actual day variations. Interest-only provides lower monthly payments with balloon principal at end, suitable for bridge financing and investment properties. All 4 amortization methods now implemented (reducing balance, flat rate, simple interest, interest-only). 52/52 tests passing. Ready for Week 3 loan product configuration.
  - Added `simple_interest` handling in `calculateLoanDetails()` method
  - Created `generateSimpleInterestSchedule()` with accurate period calculations
  - Added 4 comprehensive tests for simple interest method (48/48 tests passing)
  - Created comparison demo showing simple interest between reducing balance and flat rate costs
  - Test validates variable interest based on actual days per period
  - For ZMW 10,000 @ 24% for 6 months: Same total interest as flat rate (~ZMW 1,200) but payment amounts vary by days

- **Phase 0: Loan Engine Enhancement - Week 2, Days 3-4 ✅ COMPLETED**:
  - Implemented interest-only amortization method with balloon payment
  - Added `calculateInterestOnlyPayment()` function to interest calculator
  - Interest-only loans: Pay only interest each period, principal due at maturity
  - Added `interest_only` handling in `calculateLoanDetails()` method
  - Created `generateInterestOnlySchedule()` method with balloon payment flag
  - Added `isBalloonPayment` field to repaymentSchedule schema
  - Added 4 comprehensive tests for interest-only loans (52/52 tests passing)
  - Test validates balloon payment flag, lower regular payments, but higher total cost
  - Comparison: ZMW 50,000 @ 18% for 12 months
    * Interest-only: ZMW 750/month, ZMW 9,000 total interest, ZMW 50,000 balloon at end
    * Reducing balance: ZMW 4,584/month, ZMW 5,008 total interest
    * Interest-only is 79.71% more expensive but preserves capital
  - Created demo showing use cases (bridge financing, investment properties, business expansion)

**Week 2 In Progress**: Implemented simple interest and interest-only methods. System now supports 4 complete amortization methods. 52/52 tests passing.

### Changed
- Updated super user password reset script to avoid double-hashing
- Configured MongoDB Atlas connection string for cloud database
- Updated server package.json test scripts to use Jest
- **Loan model now uses daily interest accrual instead of monthly approximations**
- **Repayment schedules now generated with actual calendar dates**

### Fixed
- Fixed double password hashing issue in reset password utility

### Removed
- Removed local MongoDB dependency in favor of MongoDB Atlas

---

## [0.3.2] - 2026-02-09

### Added
- **Production Roadmap**:
  - Created comprehensive production readiness roadmap in `PRODUCTION_ROADMAP.md`
  - Detailed 10-phase transformation plan from MVP to enterprise-grade SaaS
  - Included gap analysis across security, infrastructure, testing, and compliance
  - Prioritized implementation with estimated timelines (16-24 weeks)
  - Aligned deployment strategy with Coolify self-hosted platform
  - Defined success metrics and KPIs for production readiness

- **Bootstrapped Cost Optimization Guide**:
  - Created `BOOTSTRAPPED_COST_OPTIMIZATION.md` for startup-friendly approach
  - Detailed self-hosting strategy for ~93% cost reduction ($3,000-17,000/year savings)
  - Complete guide for running testing infrastructure on Coolify (TestSprite alternative)
  - Self-hosted monitoring stack (Grafana, Prometheus, Loki, GlitchTip, UptimeKuma)
  - Free tier strategies for email (SendGrid), CDN (Cloudflare), and payment processing
  - Cost breakdown: $20-30/month fixed vs $300-1,500/month traditional SaaS
  - Reusable testing platform architecture for all future projects

- **Zambian Payment & Communication Guide**:
  - Created `ZAMBIAN_PAYMENT_COMMUNICATION_GUIDE.md` for local context
  - WhatsApp Business API analysis ($50-100/month minimum - not recommended)
  - Email magic link authentication guide (free alternative to SMS OTP)
  - Flutterwave payment gateway guide (available in Zambia, unlike Stripe)
  - Recurring billing support for loan repayments via Flutterwave
  - Mobile money integration (Airtel Money, MTN Mobile Money)
  - Cost comparison: Email ($0) vs WhatsApp ($600-1,200/year) vs SMS ($120-480/year)

- **Implementation Roadmap**:
  - Created `NEXT_STEPS.md` with concrete 4-week action plan
  - Week 1: Foundation & Monitoring (Grafana, Prometheus, Loki, UptimeKuma)
  - Week 2: Email magic link authentication implementation
  - Week 3: Security hardening (audit logs, validation, rate limiting)
  - Week 4: Testing foundation (Jest, Supertest, CI/CD)
  - Includes daily task breakdowns with clear deliverables
  - Success criteria defined for each week
  - Cost timeline and learning resources included

- **Loan Management System Gap Analysis**:
  - Created `LMS_GAP_ANALYSIS.md` - comprehensive enterprise LMS feature comparison (50,000+ words)
  - Analyzed 8 domains: Loan Engine, Product Flexibility, Document Management, Credit Scoring, Reporting, Compliance, Advanced Features, Integrations
  - Compared current system against Mambu, nCino, Temenos, FIS LoanServ standards
  - Identified 70+ missing features with priority rankings and effort estimates
  - Total gap: 461 development days (12+ months to full enterprise parity)
  - Current system at 40% feature completeness vs. enterprise LMS
  - Phase 1 (Months 1-3): Core loan engine enhancements - 70 days, $28k traditional (bootstrapped: $0 + 168 hours personal time)
  - Includes detailed code examples and implementation recommendations
  - Focus areas: Daily interest accrual, flat rate amortization, product configuration, document verification, affordability analysis, aging reports, SMS notifications, Flutterwave integration

- **Phase 0: Loan Engine Technical Specifications**:
  - Created `PHASE_1_LOAN_ENGINE_SPECS.md` - detailed implementation guide (18,000+ words)
  - 5 sprints over 12 weeks @ 2 hours/day time budget (168 total hours)
  - Sprint 1 (Weeks 1-2.5, 35hrs): Multiple amortization methods (reducing balance, flat rate, interest-only, equal principal)
  - Sprint 2 (Weeks 3-4.5, 35hrs): Loan product configuration system with eligibility rules
  - Sprint 3 (Weeks 5-7, 42hrs): Repayment flexibility (bi-weekly/weekly schedules, prepayment, grace periods, balloon payments)
  - Sprint 4 (Weeks 8-9.5, 28hrs): Affordability & risk analysis (DTI calculator, credit bureau integration, automated underwriting)
  - Sprint 5 (Weeks 10-12, 28hrs): Reporting & testing (PAR30/60/90 analysis, schedule exports, 300+ test cases)
  - Includes complete database schemas, API specifications, UI mockups, test cases, and success criteria
  - Budget: $0 (self-implemented, bootstrapped approach with 2hr/day commitment)

### Changed
- **Documentation Organization**:
  - Archived historical changelog from v0.1.0 to v0.3.1 as `changelog_to_feb_2026.md`
  - Created fresh changelog for tracking changes from February 2026 onwards
  - Improved maintainability by separating historical and ongoing development logs
  
- **Production Roadmap Updates for Zambian Context**:
  - Updated authentication section with email magic link implementation (passwordless)
  - Replaced Stripe references with Flutterwave (available in Zambia)
  - Updated MFA strategy to use email OTP instead of SMS (cost-effective)
  - Modified Phase 8 to reflect Flutterwave integration with mobile money support
  - Added "launch with manual payments, automate later" strategy for bootstrapped approach
  - Updated payment architecture with ZMW (Zambian Kwacha) currency support
  - **MAJOR**: Reprioritized roadmap with Phase 0 (Loan Engine Enhancement, 12 weeks) before infrastructure work
  - **MAJOR**: Updated executive summary to emphasize loan engine gaps (40% completeness vs. enterprise)
  - Rationale: Core product value must be enterprise-grade before scaling infrastructure
  - Revised total timeline: 28-36 weeks (was 16-24 weeks) with loan engine first
  
- **Implementation Roadmap Restructure**:
  - Renamed original `NEXT_STEPS.md` to `NEXT_STEPS_INFRASTRUCTURE.md` (preserved for Phase 1+)
  - Created new `NEXT_STEPS.md` focused entirely on Phase 0 (Loan Engine)
  - 12-week implementation plan (84 days, Feb 10 - May 4, 2026)
  - Tailored to 2 hours/day time budget (14 hours/week, 168 total hours)
  - Week-by-week breakdown with daily 2-hour tasks and clear deliverables
  - Includes prerequisites, testing requirements, documentation needs for each day
  - Weekly milestone checkpoints and emergency fallback plans
  - Learning resources provided for financial mathematics and IFRS 9 standards
  
- **Bootstrapped Guide Updates**:
  - Added Zambian payment gateway recommendations
  - Updated email service recommendations for authentication use case
  - Added note about Stripe unavailability in Zambia
  - Included Flutterwave pricing for Zambian market (2% mobile money, 1.4% bank transfers)
