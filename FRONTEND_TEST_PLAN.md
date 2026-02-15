# NdalamaHub LMS - Frontend Testing Plan
## Complete User Journey & Feature Validation

**Date**: February 11, 2026  
**Phase 0 Progress**: Week 4 Complete (33.3%)  
**Features to Test**: Multi-tenant setup, 4 loan types, product catalog, prepayments, reports  
**Estimated Time**: 2-3 hours for complete test suite

---

## Prerequisites

### 1. Start the Application
```bash
# Terminal 1: Start both client and server
cd /Users/williammweemba/Dev_Projects/ndalamahub_lms_app
pnpm start

# Or separately:
# Terminal 1: Server
cd server && pnpm run dev

# Terminal 2: Client
cd client && pnpm run dev
```

**Access URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### 2. Seed Test Data
```bash
# In server directory
cd /Users/williammweemba/Dev_Projects/ndalamahub_lms_app/server

# Create super user
node utils/seedSuperUser.js

# Seed complete test data (companies, users, products, loans)
pnpm run seed
```

---

## Test Data Overview

### Companies Created by Seeder

#### Lender Companies
1. **FirstBank Lending**
   - Type: Lender
   - Products: 7 loan products (Personal, Business, Payday, etc.)
   
2. **MicroCredit Solutions** (if seeded)
   - Type: Lender
   - Products: Microfinance focused

#### Corporate Companies
1. **TechCorp Zambia**
   - Type: Corporate
   - Lender: FirstBank Lending
   - Employees: ~10 users

2. **RetailMart Ltd**
   - Type: Corporate
   - Lender: FirstBank Lending
   - Employees: ~5 users

### User Accounts & Login Credentials

#### Super User (System Admin)
```
Username: superadmin
Password: Admin@2025
Role: super_user
Access: Full system access, all companies
```

#### Lender Users (FirstBank Lending)
```
Username: manager
Password: Manager@2025
Role: lender_admin
Access: Approve/disburse loans, view all corporate clients

Username: loan_officer
Password: Officer@2025
Role: lender_user
Access: View loans, limited actions
```

#### Corporate Users (TechCorp Zambia)
```
Username: david_admin
Password: Corporate@2025
Role: corporate_admin
Access: Approve employee loans, manage company

Username: hr_sarah
Password: HR@2025
Role: corporate_hr
Access: Review employee loans, HR functions

Username: john_employee
Password: Employee@2025
Role: corporate_user
Access: Apply for loans, view own loans
```

### Loan Products (Seeded by Default)

1. **Personal Loan - 18%**
   - Category: Personal
   - Method: reducing_balance
   - Rate: 18% p.a.
   - Amount: K5,000 - K50,000
   - Term: 6-36 months
   - Processing Fee: 2.5%

2. **Business Loan - 22%**
   - Category: Business
   - Method: reducing_balance
   - Rate: 22% p.a.
   - Amount: K10,000 - K200,000
   - Term: 12-60 months
   - Processing Fee: 3%

3. **Payday Loan - 7%**
   - Category: Payday
   - Method: flat_rate
   - Rate: 7% per month
   - Amount: K500 - K5,000
   - Term: 1-3 months
   - Processing Fee: 5%

4. **Bridge Loan - 24%**
   - Category: Bridge
   - Method: simple_interest
   - Rate: 24% p.a.
   - Amount: K20,000 - K100,000
   - Term: 3-12 months
   - Processing Fee: 4%

5. **Microfinance Loan - 28%**
   - Category: Microfinance
   - Method: flat_rate
   - Rate: 28% p.a.
   - Amount: K1,000 - K20,000
   - Term: 3-24 months
   - Processing Fee: 5%

6. **Auto Loan - 18%**
   - Category: Auto
   - Method: reducing_balance
   - Rate: 18% p.a.
   - Amount: K30,000 - K300,000
   - Term: 24-72 months
   - Processing Fee: 2%

7. **Education Loan - 14%**
   - Category: Education
   - Method: interest_only
   - Rate: 14% p.a.
   - Amount: K10,000 - K100,000
   - Term: 12-48 months
   - Processing Fee: 1.5%

---

## Test Scenarios

## Part 1: System Setup & Multi-Tenant Verification

### Scenario 1.1: Super User Login & Dashboard
**Objective**: Verify super user has system-wide access

**Steps:**
1. Navigate to http://localhost:5173
2. Login with:
   - Username: `superadmin`
   - Password: `Admin@2025`
3. Verify dashboard loads with system-wide statistics
4. Check navigation menu has all options:
   - Dashboard
   - Loans
   - Companies
   - Users
   - Products
   - Reports
   - Settings

**Expected Results:**
- ✅ Login successful
- ✅ Dashboard shows aggregated stats across all companies
- ✅ Can view all companies in dropdown
- ✅ Can view all loans regardless of company

**Test Data to Note:**
- Total companies: 3+ (1 super, 1+ lender, 1+ corporate)
- Total users: 10+
- Total loans: 5-10 (from seeder)

---

### Scenario 1.2: Company Management (Super User)
**Objective**: Create new companies and verify multi-tenant isolation

**Steps:**
1. Still logged in as `superadmin`
2. Navigate to Companies page
3. Click "Add Company" button

**Test Case A: Create New Lender Company**
```
Company Name: QuickCash Microfinance
Company Type: Lender
Registration Number: REG-2026-QCM-001
Tax ID: TAX-QCM-2026
Email: info@quickcash.zm
Phone: +260977123456
Address: Plot 123, Cairo Road, Lusaka
```

**Expected Results:**
- ✅ Company created successfully
- ✅ Company appears in companies list
- ✅ Can be selected as lender for corporate companies

**Test Case B: Create New Corporate Company**
```
Company Name: Mining Corp Zambia
Company Type: Corporate
Lender Company: FirstBank Lending (select from dropdown)
Registration Number: REG-2026-MCZ-001
Tax ID: TAX-MCZ-2026
Email: hr@miningcorp.zm
Phone: +260966987654
Address: Industrial Area, Ndola
```

**Expected Results:**
- ✅ Corporate company created
- ✅ Linked to FirstBank Lending
- ✅ Ready for user creation

---

### Scenario 1.3: User Management & Role-Based Access
**Objective**: Create users with different roles and verify access levels

**Steps:**
1. Navigate to Users page (as superadmin)
2. Click "Add User" button

**Test Case A: Create Lender Admin for QuickCash**
```
First Name: James
Last Name: Banda
Email: james.banda@quickcash.zm
Username: james_admin
Password: Lender@2025
Phone: +260977555111
Role: lender_admin
Company: QuickCash Microfinance
Department: Management
Position: Loans Manager
```

**Test Case B: Create Corporate Admin for Mining Corp**
```
First Name: Grace
Last Name: Mwansa
Email: grace.mwansa@miningcorp.zm
Username: grace_admin
Password: Mining@2025
Phone: +260966444222
Role: corporate_admin
Company: Mining Corp Zambia
Department: Human Resources
Position: HR Manager
Employee ID: MCZ-HR-001
```

**Test Case C: Create Corporate User for Mining Corp**
```
First Name: Patrick
Last Name: Phiri
Email: patrick.phiri@miningcorp.zm
Username: patrick_employee
Password: Employee@2025
Phone: +260955333444
Role: corporate_user
Company: Mining Corp Zambia
Department: Operations
Position: Machine Operator
Employee ID: MCZ-OPS-123
Salary: K8,500
```

**Expected Results:**
- ✅ All users created successfully
- ✅ Users see only their company's data when logged in
- ✅ Role-based menu options appear correctly

---

## Part 2: Loan Product Management

### Scenario 2.1: View & Filter Products
**Objective**: Verify product catalog functionality

**Steps:**
1. Logout and login as `manager` (FirstBank lender_admin)
2. Navigate to Products page
3. Test filters:
   - Filter by category: "Personal"
   - Filter by category: "Business"
   - Filter by category: "Payday"

**Expected Results:**
- ✅ See only FirstBank products (7 products)
- ✅ Filters work correctly
- ✅ Product cards show key details (rate, amount range, term)
- ✅ Can click product to view full details

---

### Scenario 2.2: Create Custom Loan Product
**Objective**: Create a new loan product for QuickCash

**Steps:**
1. Logout and login as `james_admin` (QuickCash lender_admin)
2. Navigate to Products page
3. Click "Create Product" button

**New Product Details:**
```
Product Name: Quick Salary Advance
Category: Payday
Calculation Method: flat_rate
Day Count Convention: actual/365
Payment Frequency: monthly

Interest Rate:
- Minimum: 5%
- Maximum: 8%
- Default: 6%

Loan Amount:
- Minimum: K500
- Maximum: K10,000
- Default: K2,000

Loan Term:
- Minimum: 1 month
- Maximum: 6 months
- Default: 3 months

Processing Fee:
- Type: Percentage
- Value: 3%
- Calculation Timing: upfront

Insurance Fee:
- Required: No

Late Payment Fee:
- Type: Fixed
- Value: K50

Early Settlement Fee:
- Type: Percentage
- Value: 2%

Eligibility Criteria:
- Minimum Age: 21
- Maximum Age: 60
- Minimum Income: K3,000
- Minimum Employment Duration: 3 months
- Minimum Credit Score: 550
- Employment Types: permanent, contract

Status: Active
```

**Expected Results:**
- ✅ Product created successfully
- ✅ Appears in QuickCash's product list
- ✅ Can be used for loan applications
- ✅ Validation works (try invalid values)

---

## Part 3: Loan Application & Approval Workflow

### Scenario 3.1: Apply for Personal Loan (Reducing Balance)
**Objective**: Test full loan lifecycle with reducing balance calculation

**Steps:**
1. Logout and login as `john_employee` (TechCorp corporate_user)
2. Navigate to Loans page
3. Click "Apply for Loan" button
4. Select "Product-Based Application"

**Loan Application Details:**
```
Loan Product: Personal Loan - 18%
Loan Amount: K25,000
Interest Rate: 18% (default from product)
Loan Term: 24 months
Payment Frequency: monthly
Purpose: Home renovation
Notes: Need funds for urgent home repairs

Collateral Details:
- Type: Property
- Value: K50,000
- Description: Title deed for residential property
```

**Expected Results:**
- ✅ Fee calculation shows automatically:
  - Processing Fee: K625 (2.5% of K25,000)
  - Total Upfront Fees: K625
  - Net Disbursement: K24,375
- ✅ Monthly installment calculated: ~K1,271
- ✅ Total repayment shown: ~K30,504
- ✅ Amortization schedule preview visible
- ✅ Submit successful, loan status: "pending_approval"

**Loan Details to Track:**
```
Loan ID: [Generated - note this down]
Applicant: john_employee (John Employee)
Company: TechCorp Zambia
Amount: K25,000
Method: reducing_balance
Status: pending_approval
```

---

### Scenario 3.2: Apply for Payday Loan (Flat Rate)
**Objective**: Test flat rate calculation method

**Steps:**
1. Still logged in as `john_employee`
2. Apply for second loan

**Loan Application Details:**
```
Loan Product: Payday Loan - 7%
Loan Amount: K3,000
Interest Rate: 7% per month (84% p.a. equivalent)
Loan Term: 3 months
Payment Frequency: monthly
Purpose: Emergency medical expenses
Notes: Urgent medical bills
```

**Expected Results:**
- ✅ Processing Fee: K150 (5% of K3,000)
- ✅ Total Interest: K630 (K3,000 × 7% × 3 months)
- ✅ Monthly Payment: K1,210 (same each month)
- ✅ Total Repayment: K3,630
- ✅ Loan submitted: "pending_approval"

**Note:** Flat rate means interest is calculated on original principal for entire term, not reducing balance.

---

### Scenario 3.3: Apply for Bridge Loan (Simple Interest)
**Objective**: Test simple interest calculation

**Steps:**
1. Logout and login as `patrick_employee` (Mining Corp user)
2. Apply for loan

**Loan Application Details:**
```
Loan Product: Bridge Loan - 24%
Loan Amount: K50,000
Interest Rate: 24% p.a.
Loan Term: 6 months
Payment Frequency: monthly
Purpose: Business expansion
Notes: Short-term working capital
```

**Expected Results:**
- ✅ Processing Fee: K2,000 (4% of K50,000)
- ✅ Total Interest: K6,000 (K50,000 × 24% × 6/12)
- ✅ Monthly Payment: K9,333.33
- ✅ Total Repayment: K56,000
- ✅ Simple interest: Interest per period on original principal

---

### Scenario 3.4: Apply for Education Loan (Interest-Only)
**Objective**: Test interest-only with balloon payment

**Steps:**
1. Still as `patrick_employee`, apply for another loan

**Loan Application Details:**
```
Loan Product: Education Loan - 14%
Loan Amount: K40,000
Interest Rate: 14% p.a.
Loan Term: 24 months
Payment Frequency: monthly
Purpose: MBA program fees
Notes: Full-time MBA at UNZA
```

**Expected Results:**
- ✅ Processing Fee: K600 (1.5% of K40,000)
- ✅ Monthly Interest Payment: K466.67
- ✅ Final Payment (Month 24): K40,466.67 (principal + interest)
- ✅ Total Repayment: K51,200
- ✅ Schedule shows: Small payments + large balloon at end

---

### Scenario 3.5: HR Review & Approval (Corporate Admin)
**Objective**: Test corporate admin approval workflow

**Steps:**
1. Logout and login as `grace_admin` (Mining Corp corporate_admin)
2. Navigate to Loans page
3. Should see Patrick's 2 loan applications (Bridge + Education)

**Test Case A: Approve Bridge Loan**
1. Click on Bridge Loan (K50,000)
2. Click "Approve" button
3. Add comment: "Verified employment and salary. Approved for processing."

**Expected Results:**
- ✅ Loan status changes: "pending_approval" → "approved"
- ✅ Approval timestamp recorded
- ✅ Comment saved
- ✅ Loan now visible to lender for disbursement

**Test Case B: Reject Education Loan**
1. Click on Education Loan (K40,000)
2. Click "Reject" button
3. Add comment: "Loan amount exceeds 5x monthly salary policy. Please reapply for lower amount."

**Expected Results:**
- ✅ Loan status: "rejected"
- ✅ Rejection reason saved
- ✅ Patrick can see rejection with comment
- ✅ Loan not sent to lender

---

### Scenario 3.6: HR Review (Corporate HR)
**Objective**: Test corporate_hr role capabilities

**Steps:**
1. Logout and login as `hr_sarah` (TechCorp corporate_hr)
2. Navigate to Loans page
3. Should see John's 2 loans (Personal + Payday)

**Test Case: Approve Both Loans**
1. Approve Personal Loan (K25,000) - Comment: "Approved based on good payment history"
2. Approve Payday Loan (K3,000) - Comment: "Emergency loan approved"

**Expected Results:**
- ✅ Both loans status: "approved"
- ✅ Ready for lender disbursement
- ✅ HR can only see TechCorp loans, not other companies

---

### Scenario 3.7: Lender Disbursement (Lender Admin)
**Objective**: Test loan disbursement and activation

**Steps:**
1. Logout and login as `manager` (FirstBank lender_admin)
2. Navigate to Loans page
3. Filter status: "approved"
4. Should see:
   - John's Personal Loan (K25,000)
   - John's Payday Loan (K3,000)
   - Patrick's Bridge Loan (K50,000)

**Test Case A: Disburse Personal Loan**
1. Click on Personal Loan
2. Click "Disburse" button
3. Confirm disbursement details:
   - Amount: K25,000
   - Net Disbursement: K24,375 (after processing fee)
4. Add disbursement notes: "Funds transferred to account ending 1234"

**Expected Results:**
- ✅ Loan status changes: "approved" → "active"
- ✅ Disbursement date recorded (today's date)
- ✅ Repayment schedule activated
- ✅ First installment due date calculated (1 month from today)
- ✅ Loan now appears in "Active Loans" filter

**Test Case B: Disburse Payday Loan**
Follow same process for K3,000 payday loan

**Test Case C: Disburse Bridge Loan**
Follow same process for K50,000 bridge loan

**Verify Multi-Tenant Security:**
- ✅ Manager can only see FirstBank's corporate clients (TechCorp, Mining Corp)
- ✅ Cannot see QuickCash loans (different lender)
- ✅ Cannot disburse loans from other lenders

---

## Part 4: Repayment & Prepayment Testing

### Scenario 4.1: Record Regular Repayment
**Objective**: Test standard loan payment recording

**Steps:**
1. Still logged in as `manager` (lender_admin)
2. Navigate to Loans page
3. Filter status: "active"
4. Click on Personal Loan (K25,000, John Employee)

**Record First Payment:**
1. Click "Record Payment" button
2. Payment details:
   ```
   Payment Amount: K1,271 (scheduled installment)
   Payment Date: 2026-03-11 (1 month from disbursement)
   Payment Method: Bank Transfer
   Reference Number: TXN-2026-001234
   Notes: Monthly installment - on time
   ```

**Expected Results:**
- ✅ Payment recorded successfully
- ✅ Installment 1 marked as "paid"
- ✅ Next due date: 2026-04-11
- ✅ Outstanding balance reduced: K25,000 → K24,098 (approx)
- ✅ Payment history updated

**Record Multiple Payments:**
Repeat for 3-4 more months to have payment history

---

### Scenario 4.2: Early Settlement Quote
**Objective**: Test early settlement calculation (Week 4 feature)

**Steps:**
1. On the Personal Loan details page (after 3-4 payments made)
2. Click "Make Prepayment" button
3. Click "Get Settlement Quote" button

**Expected Settlement Quote:**
```
Settlement Date: 2026-05-11 (example)
Remaining Principal: ~K22,500
Accrued Interest (to date): ~K350
Early Settlement Fee: ~K450 (2% of remaining balance)
Total Settlement Amount: ~K23,300

Savings: ~K7,200 (vs continuing full term)
Months Saved: 20 months
```

**Expected Results:**
- ✅ Quote shows detailed breakdown
- ✅ Savings calculation correct
- ✅ Fee calculation based on product configuration
- ✅ Quote is read-only (not yet settled)

---

### Scenario 4.3: Partial Prepayment - Reduce Term
**Objective**: Test prepayment with term reduction strategy

**Steps:**
1. Still on Personal Loan prepayment dialog
2. Choose "Reduce Term" strategy
3. Enter prepayment amount: K5,000

**Expected Prepayment Results:**
```
Prepayment Amount: K5,000
Allocation:
- To Interest: ~K350 (accrued interest first)
- To Principal: ~K4,650
- Processing Fee: K0 (no fee for prepayment)

Impact with "Reduce Term" Strategy:
- Original Term: 24 months
- Payments Made: 4
- Remaining Payments: 20 → ~14 months
- Monthly Payment: K1,271 (stays same)
- New Loan Maturity: 2027-08-11 → 2027-02-11 (6 months earlier)

Total Interest Saved: ~K2,500
```

4. Add notes: "Bonus payment - reduce loan term"
5. Click "Record Prepayment"

**Expected Results:**
- ✅ Prepayment recorded in history
- ✅ Schedule recalculated automatically
- ✅ Remaining installments reduced from 20 → 14
- ✅ Monthly payment stays K1,271
- ✅ New maturity date calculated
- ✅ Prepayment appears in history with "reduce_term" badge

---

### Scenario 4.4: Partial Prepayment - Reduce Payment
**Objective**: Test prepayment with payment reduction strategy

**Steps:**
1. Navigate to Payday Loan (K3,000, flat rate)
2. Record 1 regular payment first (K1,210)
3. Click "Make Prepayment" button
4. Choose "Reduce Payment" strategy
5. Enter prepayment amount: K1,000

**Expected Prepayment Results:**
```
Prepayment Amount: K1,000
Allocation:
- To Interest: ~K175 (accrued interest)
- To Principal: ~K825

Impact with "Reduce Payment" Strategy:
- Original Term: 3 months
- Payments Made: 1
- Remaining Payments: 2 (stays same)
- Original Monthly Payment: K1,210
- New Monthly Payment: ~K905 (reduced)
- Loan Maturity: Unchanged

Total Interest Saved: ~K175 (interest portion of prepayment)
```

6. Add notes: "Extra payment to reduce monthly burden"
7. Click "Record Prepayment"

**Expected Results:**
- ✅ Prepayment recorded
- ✅ Schedule recalculated
- ✅ Remaining 2 payments reduced: K1,210 → K905 each
- ✅ Term stays at 3 months
- ✅ Payment reduction reflected in schedule

---

### Scenario 4.5: Early Settlement (Full Payoff)
**Objective**: Test full loan payoff

**Steps:**
1. Navigate to Bridge Loan (K50,000, simple interest)
2. Record 2-3 regular payments first
3. Click "Make Prepayment" button
4. Review settlement quote
5. Click "Settle Loan Early" button

**Expected Settlement:**
```
Settlement Date: 2026-05-11 (example)
Outstanding Principal: ~K41,667
Accrued Interest: ~K1,167
Early Settlement Fee: ~K833 (2% of K41,667)
Total Settlement Amount: ~K43,667

Payment Method: Bank Transfer
Reference: SETTLEMENT-2026-001
Notes: Full loan payoff - business sold
```

6. Confirm settlement

**Expected Results:**
- ✅ Loan status changes: "active" → "completed"
- ✅ Settlement amount recorded
- ✅ Settlement date saved
- ✅ Savings calculated and shown
- ✅ Loan closed, no further payments due
- ✅ Early settlement appears in loan history

---

### Scenario 4.6: View Prepayment History
**Objective**: Test prepayment audit trail

**Steps:**
1. On Personal Loan details (the one with K5,000 prepayment)
2. Click "View Prepayment History" button

**Expected History Display:**
```
Prepayment Summary:
- Total Prepayments: 1
- Total Amount: K5,000
- Principal Portion: K4,650
- Interest Portion: K350
- Strategy Used: Reduce Term

Prepayment List:
1. Date: 2026-05-11
   Amount: K5,000
   Strategy: Reduce Term (badge)
   Principal: K4,650
   Interest: K350
   Recorded By: manager (James Banda)
   Notes: Bonus payment - reduce loan term
```

**Expected Results:**
- ✅ Summary card with totals
- ✅ Chronological list of prepayments
- ✅ All details visible (amount, allocation, strategy)
- ✅ Recorded by information for audit
- ✅ Notes displayed

---

## Part 5: Reports & Analytics Testing

### Scenario 5.1: Dashboard Statistics (Lender Admin)
**Objective**: Verify lender dashboard calculations

**Steps:**
1. Logged in as `manager` (FirstBank lender_admin)
2. Navigate to Dashboard

**Expected Dashboard Metrics:**
```
Portfolio Overview:
- Total Active Loans: 3
- Total Loan Amount: K78,000 (K25k + K3k + K50k)
- Outstanding Balance: ~K73,000 (after payments)
- Total Interest Earned: ~K2,500 (from payments received)

Loan Status Breakdown:
- Active: 3
- Pending Approval: 0 (all processed)
- Completed: 0 (unless settlement tested)
- In Arrears: 0 (all on time)

Recent Activity:
- Latest disbursement
- Recent payments
- Recent prepayments
```

**Expected Results:**
- ✅ Metrics accurately reflect test loans
- ✅ Charts display correctly
- ✅ Only shows FirstBank's portfolio
- ✅ Real-time calculations

---

### Scenario 5.2: Dashboard Statistics (Corporate Admin)
**Objective**: Verify corporate admin sees company-specific data

**Steps:**
1. Logout and login as `grace_admin` (Mining Corp admin)
2. Navigate to Dashboard

**Expected Dashboard:**
```
Employee Loans Overview:
- Active Loans: 1 (Bridge Loan)
- Total Amount Borrowed: K50,000
- Total Outstanding: ~K42,000
- Employees with Loans: 1 (Patrick)

Approval Statistics:
- Pending Review: 0
- Approved This Month: 1
- Rejected This Month: 1 (Education Loan)

Employee Loan Performance:
- On-time Payments: 100%
- In Arrears: 0
```

**Expected Results:**
- ✅ Only Mining Corp data visible
- ✅ Cannot see TechCorp loans
- ✅ Statistics accurate for company scope

---

### Scenario 5.3: Loan Report Generation (PDF)
**Objective**: Test PDF report export

**Steps:**
1. Logged in as `manager` (lender_admin)
2. Navigate to Reports page
3. Select Report Type: "Loan Portfolio Report"
4. Set filters:
   ```
   Date Range: Last 3 months
   Loan Status: Active
   Company: All (FirstBank's corporate clients)
   Format: PDF
   ```
5. Click "Generate Report"

**Expected PDF Report Contents:**
```
Report Header:
- FirstBank Lending
- Loan Portfolio Report
- Date Range: 2025-11-11 to 2026-02-11
- Generated: 2026-02-11

Summary Section:
- Total Loans: 3
- Total Principal: K78,000
- Total Outstanding: ~K73,000
- Average Interest Rate: 17.3%

Loan Listing:
1. Personal Loan - John Employee (TechCorp)
   - Amount: K25,000
   - Rate: 18%
   - Term: 24 months
   - Outstanding: ~K22,500
   - Status: Active

2. Payday Loan - John Employee (TechCorp)
   - Amount: K3,000
   - Rate: 7% monthly
   - Term: 3 months
   - Outstanding: ~K1,000
   - Status: Active

3. Bridge Loan - Patrick Phiri (Mining Corp)
   - Amount: K50,000
   - Rate: 24%
   - Term: 6 months
   - Outstanding: ~K42,000
   - Status: Active

Payment Summary:
- Total Payments Received: ~K7,500
- On-time Payment Rate: 100%
- Prepayments: K6,000 (2 instances)
```

**Expected Results:**
- ✅ PDF downloads successfully
- ✅ Contains all active loans
- ✅ Accurate calculations
- ✅ Professional formatting
- ✅ Company branding (if configured)

---

### Scenario 5.4: Repayment Schedule Export (Excel)
**Objective**: Test Excel export functionality

**Steps:**
1. Still as `manager`, go to Reports page
2. Select Report Type: "Repayment Schedule Report"
3. Set filters:
   ```
   Loan: Personal Loan (K25,000 - John Employee)
   Include Paid Installments: Yes
   Include Prepayments: Yes
   Format: Excel
   ```
4. Click "Generate Report"

**Expected Excel Structure:**
```
Sheet 1: Loan Details
- Borrower: John Employee
- Company: TechCorp Zambia
- Loan Amount: K25,000
- Interest Rate: 18%
- Term: 24 months
- Method: reducing_balance
- Disbursement Date: 2026-02-11

Sheet 2: Repayment Schedule
| Inst. | Due Date   | Principal | Interest | Payment  | Balance  | Status    |
|-------|------------|-----------|----------|----------|----------|-----------|
| 1     | 2026-03-11 | 1,096.00  | 175.00   | 1,271.00 | 23,904.00| Paid      |
| 2     | 2026-04-11 | 1,112.46  | 158.54   | 1,271.00 | 22,791.54| Paid      |
| 3     | 2026-05-11 | 1,129.17  | 141.83   | 1,271.00 | 21,662.37| Unpaid    |
| ...   | ...        | ...       | ...      | ...      | ...      | ...       |
| 24    | 2028-02-11 | 1,252.83  | 18.17    | 1,271.00 | 0.00     | Unpaid    |

Sheet 3: Prepayment History
| Date       | Amount   | Strategy    | Principal | Interest | New Term |
|------------|----------|-------------|-----------|----------|----------|
| 2026-05-11 | 5,000.00 | Reduce Term | 4,650.00  | 350.00   | 14 mo.   |

Sheet 4: Summary
- Total Scheduled: K30,504.00
- Total Paid: K2,542.00
- Total Outstanding: K27,962.00
- Prepayments: K5,000.00
- Adjusted Term: 18 months (from 24)
```

**Expected Results:**
- ✅ Excel file downloads (.xlsx)
- ✅ Multiple sheets with organized data
- ✅ Accurate calculations in all cells
- ✅ Professional formatting
- ✅ Can be opened in Excel/Google Sheets

---

### Scenario 5.5: Aging Report (Lender Admin)
**Objective**: Test aging analysis (if implemented)

**Steps:**
1. Navigate to Reports page
2. Select Report Type: "Aging Report"
3. Generate report

**Expected Report:**
```
Aging Buckets:
- Current (0-30 days): 3 loans, K73,000
- 31-60 days: 0 loans, K0
- 61-90 days: 0 loans, K0
- Over 90 days: 0 loans, K0

Risk Assessment:
- Low Risk: 100%
- Medium Risk: 0%
- High Risk: 0%
```

**Note**: All test loans should be current since we're testing on-time payments.

---

## Part 6: Edge Cases & Validation Testing

### Scenario 6.1: Validation Testing
**Objective**: Verify form validation works correctly

**Test Case A: Invalid Loan Application**
1. Login as `john_employee`
2. Try to apply for loan with invalid data:
   ```
   Amount: K100,000,000 (exceeds product maximum)
   Term: 100 months (exceeds product maximum)
   Interest Rate: 5% (below product minimum)
   ```

**Expected Results:**
- ✅ Form shows validation errors
- ✅ Cannot submit until corrected
- ✅ Error messages are clear

**Test Case B: Duplicate Loan Prevention**
1. Try to apply for identical loan while one is pending
2. System should warn or prevent duplicate applications

**Test Case C: Insufficient Prepayment**
1. Try to make prepayment of K50 on K25,000 loan
2. System should accept (no minimum prepayment)

**Test Case D: Overpayment Prevention**
1. Try to prepay more than outstanding balance
2. System should cap at settlement amount

---

### Scenario 6.2: Multi-Tenant Security Testing
**Objective**: Verify data isolation between companies

**Test Case A: Lender Isolation**
1. Login as `james_admin` (QuickCash lender)
2. Navigate to Loans page
3. Should see ONLY QuickCash loans (0 if none applied)
4. Should NOT see FirstBank loans

**Test Case B: Corporate Isolation**
1. Login as `grace_admin` (Mining Corp admin)
2. Should see ONLY Mining Corp employee loans
3. Should NOT see TechCorp employee loans

**Test Case C: Cross-Company Application Prevention**
1. Login as `john_employee` (TechCorp)
2. Try to apply for loan
3. Should only see FirstBank products (TechCorp's lender)
4. Should NOT see QuickCash products

---

### Scenario 6.3: Permission Testing
**Objective**: Verify role-based access controls

**Test Case A: Corporate User Limitations**
1. Login as `patrick_employee` (corporate_user)
2. Navigate to menu
3. Should NOT see:
   - Companies page
   - Users page (unless basic profile)
   - System settings
4. Can ONLY:
   - Apply for loans
   - View own loans
   - Update profile

**Test Case B: Lender User Limitations**
1. Login as `loan_officer` (lender_user)
2. Should see loans but CANNOT:
   - Approve loans
   - Disburse loans
   - Delete loans
3. Can ONLY:
   - View loans
   - Generate reports

**Test Case C: Disbursement Restrictions**
1. Login as `hr_sarah` (corporate_hr)
2. Try to access disbursement function
3. Should NOT have "Disburse" button
4. Only lender_admin can disburse

---

## Part 7: Performance & Stress Testing

### Scenario 7.1: Bulk Loan Creation
**Objective**: Test system with multiple loans

**Steps:**
1. Create 10-20 loan applications quickly
2. Process them through approval workflow
3. Disburse all
4. Record payments on all

**Monitor:**
- ✅ Dashboard loads quickly with multiple loans
- ✅ List pages paginate correctly
- ✅ Search/filter functions work
- ✅ No browser console errors

---

### Scenario 7.2: Large Prepayment Test
**Objective**: Test schedule recalculation with large prepayment

**Steps:**
1. On K25,000 personal loan with K22,500 outstanding
2. Make prepayment of K20,000 (88% of balance)
3. Choose "Reduce Term" strategy

**Expected Results:**
- ✅ Recalculation completes quickly (< 2 seconds)
- ✅ Remaining term reduced to 1-2 months
- ✅ Final installments calculated correctly
- ✅ No calculation errors

---

## Test Completion Checklist

### Multi-Tenant Setup ✅
- [x] Super user login works
- [x] Created 2 lender companies
- [x] Created 2 corporate companies
- [x] Created 8+ users across all roles
- [x] Data isolation verified between companies

### Product Catalog ✅
- [x] All 7 default products visible
- [x] Created custom product successfully
- [x] Product filtering works
- [x] Fee calculations accurate
- [x] Eligibility checks work

### Loan Lifecycle ✅
- [x] Applied for reducing_balance loan
- [x] Applied for flat_rate loan
- [x] Applied for simple_interest loan
- [x] Applied for interest_only loan
- [x] Corporate HR approved loans
- [x] Corporate admin approved/rejected loans
- [x] Lender admin disbursed loans
- [x] All 4 calculation methods work correctly

### Repayment & Prepayment ✅
- [x] Recorded regular payments
- [x] Generated settlement quote
- [x] Made partial prepayment (reduce term)
- [ ] Made partial prepayment (reduce payment)
- [x] Settled loan early (full payoff)
- [ ] Viewed prepayment history
- [x] Schedule recalculation works for all methods

### Reports & Analytics ✅
- [x] Lender dashboard shows correct stats
- [x] Corporate dashboard shows correct stats
- [x] Generated PDF loan portfolio report
- [x] Exported Excel repayment schedule
- [x] Generated aging report (if available)
- [x] All calculations accurate

### Security & Validation ✅
- [ ] Form validations work
- [ ] Multi-tenant isolation verified
- [ ] Role-based permissions enforced
- [ ] Cross-company access prevented
- [ ] Disbursement restricted to lender_admin

---

## Known Issues & Limitations

### Current Implementation
1. **No SMS/Email Notifications**: Approvals/disbursements not sent to users
2. **No Payment Reminders**: System doesn't send due date reminders
3. **Limited Reporting**: Some advanced reports not yet implemented
4. **No Automated Arrears**: Manual marking of overdue loans
5. **No Payment Gateway Integration**: Manual payment recording only

### Future Enhancements (Week 5+)
- Grace periods & payment moratorium
- Automated late fee calculation
- SMS/email integration
- Payment gateway integration
- Advanced analytics & forecasting
- Mobile app

---

## Troubleshooting Common Issues

### Issue: "Cannot read property 'company' of undefined"
**Solution:** User not logged in or token expired. Logout and login again.

### Issue: "Access denied" when trying to disburse
**Solution:** Only lender_admin role can disburse. Check user role.

### Issue: Products not showing for corporate user
**Solution:** Verify corporate company has lenderCompany set correctly.

### Issue: Prepayment button not visible
**Solution:** Loan must be in "active" status. Check loan status.

### Issue: Schedule recalculation seems wrong
**Solution:** Verify calculation method. Flat rate behaves differently than reducing balance.

### Issue: Dashboard shows K0 for all metrics
**Solution:** No loans created yet, or logged in as wrong user. Check company/role.

---

## Test Data Summary

### Quick Reference - Login Credentials

| Username         | Password       | Role            | Company          | Purpose                |
|------------------|----------------|-----------------|------------------|------------------------|
| superadmin       | Admin@2025     | super_user      | System           | System administration  |
| manager          | Manager@2025   | lender_admin    | FirstBank        | Approve/disburse loans |
| james_admin      | Lender@2025    | lender_admin    | QuickCash        | Test multi-lender      |
| grace_admin      | Mining@2025    | corporate_admin | Mining Corp      | Approve employee loans |
| hr_sarah         | HR@2025        | corporate_hr    | TechCorp         | Review employee loans  |
| john_employee    | Employee@2025  | corporate_user  | TechCorp         | Apply for loans        |
| patrick_employee | Employee@2025  | corporate_user  | Mining Corp      | Apply for loans        |

### Test Loans Created

| Loan Type        | Borrower | Amount   | Method            | Term      | Status  |
|------------------|----------|----------|-------------------|-----------|---------|
| Personal         | John     | K25,000  | reducing_balance  | 24 months | Active  |
| Payday           | John     | K3,000   | flat_rate         | 3 months  | Active  |
| Bridge           | Patrick  | K50,000  | simple_interest   | 6 months  | Active  |
| Education        | Patrick  | K40,000  | interest_only     | 24 months | Rejected|

### Prepayments Made

| Loan     | Amount  | Strategy      | Impact                    |
|----------|---------|---------------|---------------------------|
| Personal | K5,000  | Reduce Term   | 24 mo → 18 mo             |
| Payday   | K1,000  | Reduce Payment| K1,210 → K905/month       |
| Bridge   | K43,667 | Settlement    | Loan completed early      |

---

## Next Steps After Testing

1. **Document Bugs**: Note any issues found during testing
2. **Create GitHub Issues**: For bugs or enhancement requests
3. **Update Test Cases**: Add new scenarios as features are added
4. **🔴 CRITICAL: Revert to Production-Ready Payment System**
5. **Proceed to Week 5**: Grace periods & payment moratorium implementation

---

## 🔴 PRODUCTION READINESS: Payment System Reversion

**⚠️ IMPORTANT: Before deploying to production, the following changes MUST be made:**

### Current State (Testing Mode)
The system currently allows **future-dated loan repayments** for testing and simulation purposes. This enables comprehensive testing of payment workflows without waiting for actual due dates.

### Required Changes for Production

#### 1. Update RecordPaymentDialog Component
**File**: `client/src/components/loans/RecordPaymentDialog.jsx`

**Change Line ~114-125** (Payment Date field):
```jsx
// CURRENT (Testing Mode):
<Input
  id="paymentDate"
  type="date"
  value={formData.paymentDate}
  onChange={(e) => handleChange('paymentDate', e.target.value)}
  disabled={loading}
  required
  max="2099-12-31"  // ❌ Remove this - allows future dates
/>

// PRODUCTION (Real-time Only):
<Input
  id="paymentDate"
  type="date"
  value={formData.paymentDate}
  onChange={(e) => handleChange('paymentDate', e.target.value)}
  disabled={loading}
  required
  max={new Date().toISOString().split('T')[0]}  // ✅ Today or past only
/>
```

**Remove Testing Warning (Lines ~87-95)**:
```jsx
// DELETE THIS ENTIRE ALERT:
<Alert className="bg-yellow-50 border-yellow-300">
  <AlertCircle className="h-4 w-4 text-yellow-600" />
  <AlertDescription className="text-yellow-800 text-sm">
    <strong>Testing Mode:</strong> Future-dated payments are currently enabled...
  </AlertDescription>
</Alert>
```

#### 2. Update Backend API Validation
**File**: `server/routes/loans.js` (Line ~745)

**Add after line 745** (after paymentDate validation):
```javascript
// Validate payment date is not in the future
const paymentDateObj = new Date(paymentDate);
const today = new Date();
today.setHours(0, 0, 0, 0);
paymentDateObj.setHours(0, 0, 0, 0);

if (paymentDateObj > today) {
  return res.status(400).json({
    success: false,
    message: 'Payment date cannot be in the future. Please use today or a past date.'
  });
}
```

#### 3. Update Documentation
**File**: `client/src/components/loans/RecordPaymentDialog.jsx` (Line ~3)

**Update component docstring**:
```javascript
/**
 * RecordPaymentDialog - Component for recording regular scheduled loan payments
 * 
 * Features:
 * - Payment amount (pre-filled with installment amount)
 * - Payment date (PRODUCTION: Today or past dates only)  // ✅ Update this line
 * - Payment method (Bank Transfer, Cash, Cheque, Mobile Money, etc.)
 * - Reference number (transaction ID)
 * - Notes (optional)
 */
```

### Why This Matters

**Compliance & Best Practices:**
- ✅ Prevents data manipulation and fraud
- ✅ Aligns with banking and financial industry standards
- ✅ Maintains audit trail integrity
- ✅ Complies with accounting principles (transactions recorded on actual date)
- ✅ Prevents backdating or forward-dating payments

**Real-World Banking:**
- Banks never accept future-dated payment postings
- Payments are recorded when they actually occur
- Scheduled payments use separate "standing order" or "future payment" systems

### Testing vs Production Summary

| Feature | Testing Mode | Production Mode |
|---------|-------------|-----------------|
| **Payment Date Range** | Any date (past/future) | Today or past only |
| **Use Case** | Simulation & testing | Real transactions |
| **Warning Display** | Yellow alert shown | No warning needed |
| **Backend Validation** | None | Future date blocked |
| **Compliance** | N/A | Required for audit |

### Verification Checklist

Before production deployment, verify:
- [ ] Payment date input has `max={new Date().toISOString().split('T')[0]}`
- [ ] Testing warning alert removed from RecordPaymentDialog
- [ ] Backend validation added to reject future dates
- [ ] Component documentation updated
- [ ] Test that attempting future date shows error
- [ ] Test that today's date works
- [ ] Test that past date works
- [ ] Verify error message is user-friendly

---

**Estimated Testing Time**: 2-3 hours for complete test suite

**Questions During Testing?** Check server logs at `/Users/williammweemba/Dev_Projects/ndalamahub_lms_app/server/logs/` or browser console for errors.
