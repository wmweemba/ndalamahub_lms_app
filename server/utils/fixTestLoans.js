const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const LoanProduct = require('../models/LoanProduct');
require('dotenv').config();

async function fixTestLoans() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get products
    const personalProduct = await LoanProduct.findOne({ category: 'personal', name: /Personal Loan/ });
    const paydayProduct = await LoanProduct.findOne({ category: 'payday', name: /Payday Loan/ });
    const bridgeProduct = await LoanProduct.findOne({ category: 'bridge', name: /Bridge Loan/ });
    
    console.log('📦 Found Products:');
    console.log(`  Personal: ${personalProduct._id} - ${personalProduct.fees.processingFee.amount}%`);
    console.log(`  Payday: ${paydayProduct._id} - ${paydayProduct.fees.processingFee.amount}%`);
    console.log(`  Bridge: ${bridgeProduct._id} - ${bridgeProduct.fees.processingFee.amount}%\n`);
    
    // Update LN20260001 - Personal Loan K25,000
    const loan1 = await Loan.findOne({ loanNumber: 'LN20260001' });
    const fee1 = personalProduct.calculateProcessingFee(loan1.amount);
    await Loan.findByIdAndUpdate(loan1._id, {
      $set: {
        product: personalProduct._id,
        'fees.processing': fee1,
        'fees.insurance': 0
      }
    });
    console.log(`✅ LN20260001 (Personal Loan)`);
    console.log(`   Amount: K${loan1.amount}`);
    console.log(`   Processing Fee: K${fee1}`);
    console.log(`   Net Disbursement: K${loan1.amount - fee1}\n`);
    
    // Update LN20260002 - Payday Loan K3,000
    const loan2 = await Loan.findOne({ loanNumber: 'LN20260002' });
    const fee2 = paydayProduct.calculateProcessingFee(loan2.amount);
    await Loan.findByIdAndUpdate(loan2._id, {
      $set: {
        product: paydayProduct._id,
        'fees.processing': fee2,
        'fees.insurance': 0
      }
    });
    console.log(`✅ LN20260002 (Payday Loan)`);
    console.log(`   Amount: K${loan2.amount}`);
    console.log(`   Processing Fee: K${fee2}`);
    console.log(`   Net Disbursement: K${loan2.amount - fee2}\n`);
    
    // Update LN20260003 - Bridge Loan K50,000
    const loan3 = await Loan.findOne({ loanNumber: 'LN20260003' });
    const fee3 = bridgeProduct.calculateProcessingFee(loan3.amount);
    await Loan.findByIdAndUpdate(loan3._id, {
      $set: {
        product: bridgeProduct._id,
        'fees.processing': fee3,
        'fees.insurance': 0
      }
    });
    console.log(`✅ LN20260003 (Bridge Loan)`);
    console.log(`   Amount: K${loan3.amount}`);
    console.log(`   Processing Fee: K${fee3}`);
    console.log(`   Net Disbursement: K${loan3.amount - fee3}\n`);
    
    // Verify
    console.log('🔍 Verification:');
    const verifyLoans = await Loan.find({
      loanNumber: { $in: ['LN20260001', 'LN20260002', 'LN20260003'] }
    }).populate('product');
    
    for (const loan of verifyLoans) {
      const net = loan.amount - (loan.fees?.processing || 0);
      console.log(`${loan.loanNumber} (${loan.product?.name})`);
      console.log(`  Amount: K${loan.amount} | Fee: K${loan.fees?.processing || 0} | Net: K${net}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done! Now test disbursement in the UI.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTestLoans();
