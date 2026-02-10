# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: For changes prior to February 2026, see [changelog_to_feb_2026.md](./changelog_to_feb_2026.md)

## [Unreleased]

### Added
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
