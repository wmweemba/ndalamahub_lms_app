import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/utils/api';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  Calculator,
  Shield,
  Info
} from 'lucide-react';

const categoryColors = {
  personal: 'bg-blue-100 text-blue-800',
  business: 'bg-purple-100 text-purple-800',
  payday: 'bg-green-100 text-green-800',
  bridge: 'bg-orange-100 text-orange-800',
  microfinance: 'bg-pink-100 text-pink-800',
  auto: 'bg-indigo-100 text-indigo-800',
  education: 'bg-teal-100 text-teal-800',
  mortgage: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800'
};

export default function ProductComparison() {
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [comparisonData, setComparisonData] = useState({
    amount: '50000',
    term: '24'
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products?isActive=true');
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductSelection = (product) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p._id === product._id);
      if (exists) {
        return prev.filter(p => p._id !== product._id);
      } else if (prev.length < 4) {
        return [...prev, product];
      }
      return prev;
    });
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const calculateMonthlyPayment = (product) => {
    const amount = parseFloat(comparisonData.amount);
    const term = parseInt(comparisonData.term);
    const rate = product.interestRate.default / 100;

    // Check if amount is within product limits
    if (amount < product.amount.min || amount > product.amount.max) {
      return null;
    }

    // Check if term is within product limits
    if (term < product.term.min || term > product.term.max) {
      return null;
    }

    // Calculate based on method
    if (product.interestCalculation.method === 'reducing_balance') {
      const monthlyRate = rate / 12;
      const payment = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
      return {
        monthly: payment,
        total: payment * term,
        totalInterest: (payment * term) - amount
      };
    } else if (product.interestCalculation.method === 'flat_rate') {
      const totalInterest = amount * rate * (term / 12);
      const total = amount + totalInterest;
      const monthly = total / term;
      return {
        monthly,
        total,
        totalInterest
      };
    } else if (product.interestCalculation.method === 'simple_interest') {
      const totalInterest = amount * rate * (term / 12);
      const total = amount + totalInterest;
      const monthly = total / term;
      return {
        monthly,
        total,
        totalInterest
      };
    } else if (product.interestCalculation.method === 'interest_only') {
      const monthlyInterest = (amount * rate) / 12;
      const total = (monthlyInterest * term) + amount;
      return {
        monthly: monthlyInterest,
        total,
        totalInterest: monthlyInterest * term,
        balloon: amount
      };
    }

    return null;
  };

  const calculateFees = (product) => {
    const amount = parseFloat(comparisonData.amount);
    let processingFee = 0;
    let insuranceFee = 0;

    if (product.fees?.processingFee) {
      processingFee = product.fees.processingFee.type === 'percentage'
        ? (amount * product.fees.processingFee.amount) / 100
        : product.fees.processingFee.amount;
    }

    if (product.fees?.insuranceFee && product.fees.insuranceFee.required) {
      insuranceFee = product.fees.insuranceFee.type === 'percentage'
        ? (amount * product.fees.insuranceFee.amount) / 100
        : product.fees.insuranceFee.amount;
    }

    return { processingFee, insuranceFee, total: processingFee + insuranceFee };
  };

  const categories = ['all', ...new Set(products.map(p => p.category))];
  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(p => p.category === filter);

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Compare Loan Products</h1>
        <p className="text-gray-600 mt-2">Select up to 4 products to compare side-by-side</p>
      </div>

      {/* Comparison Parameters */}
      <Card className="p-4 md:p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-blue-600" />
          Comparison Parameters
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">Loan Amount (ZMW)</Label>
            <Input
              id="amount"
              type="number"
              value={comparisonData.amount}
              onChange={(e) => setComparisonData(prev => ({ ...prev, amount: e.target.value }))}
              min="1000"
              step="1000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="term">Loan Term (months)</Label>
            <Input
              id="term"
              type="number"
              value={comparisonData.term}
              onChange={(e) => setComparisonData(prev => ({ ...prev, term: e.target.value }))}
              min="1"
              max="60"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {/* Selected Products Comparison */}
      {selectedProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Selected Products ({selectedProducts.length}/4)</h2>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear All
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2">
                  <th className="p-3 text-left font-semibold text-gray-700 bg-gray-50">Feature</th>
                  {selectedProducts.map(product => (
                    <th key={product._id} className="p-3 text-left font-semibold bg-gray-50 min-w-[200px]">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <span className="text-sm">{product.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProductSelection(product)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Badge className={categoryColors[product.category]}>
                          {product.category}
                        </Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Interest Rate */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Interest Rate</td>
                  {selectedProducts.map(product => (
                    <td key={product._id} className="p-3">
                      <span className="text-blue-600 font-semibold">{product.interestRate.default}%</span>
                      <span className="text-xs text-gray-500 block">({product.interestRate.min}% - {product.interestRate.max}%)</span>
                    </td>
                  ))}
                </tr>

                {/* Amount Range */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Amount Range</td>
                  {selectedProducts.map(product => (
                    <td key={product._id} className="p-3 text-sm">
                      {product.amount.currency} {product.amount.min.toLocaleString()} - {product.amount.max.toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* Term Range */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Term Range</td>
                  {selectedProducts.map(product => (
                    <td key={product._id} className="p-3 text-sm">
                      {product.term.min} - {product.term.max} months
                    </td>
                  ))}
                </tr>

                {/* Monthly Payment */}
                <tr className="border-b hover:bg-gray-50 bg-blue-50">
                  <td className="p-3 font-medium text-gray-700">Monthly Payment</td>
                  {selectedProducts.map(product => {
                    const calc = calculateMonthlyPayment(product);
                    return (
                      <td key={product._id} className="p-3">
                        {calc ? (
                          <div>
                            <span className="text-lg font-bold text-blue-600">
                              {product.amount.currency} {calc.monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            {calc.balloon && (
                              <span className="text-xs text-orange-600 block">+ balloon: {product.amount.currency} {calc.balloon.toLocaleString()}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-red-600">Out of range</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Interest */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Total Interest</td>
                  {selectedProducts.map(product => {
                    const calc = calculateMonthlyPayment(product);
                    return (
                      <td key={product._id} className="p-3">
                        {calc ? (
                          <span className="font-semibold text-orange-600">
                            {product.amount.currency} {calc.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Repayment */}
                <tr className="border-b hover:bg-gray-50 bg-green-50">
                  <td className="p-3 font-medium text-gray-700">Total Repayment</td>
                  {selectedProducts.map(product => {
                    const calc = calculateMonthlyPayment(product);
                    return (
                      <td key={product._id} className="p-3">
                        {calc ? (
                          <span className="text-lg font-bold text-green-600">
                            {product.amount.currency} {calc.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Processing Fee */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Processing Fee</td>
                  {selectedProducts.map(product => {
                    const fees = calculateFees(product);
                    return (
                      <td key={product._id} className="p-3 text-sm">
                        {fees.processingFee > 0 ? (
                          <span>{product.amount.currency} {fees.processingFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Collateral Required */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Collateral</td>
                  {selectedProducts.map(product => (
                    <td key={product._id} className="p-3">
                      {product.collateralRequired ? (
                        <Badge className="bg-orange-100 text-orange-800">Required</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Not Required</Badge>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Calculation Method */}
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">Interest Method</td>
                  {selectedProducts.map(product => (
                    <td key={product._id} className="p-3 text-sm capitalize">
                      {product.interestCalculation.method.replace(/_/g, ' ')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Selection */}
      <div>
        <h2 className="text-xl font-bold mb-4">Available Products</h2>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={filter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(cat)}
              className="capitalize"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const isSelected = selectedProducts.find(p => p._id === product._id);
            return (
              <Card 
                key={product._id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => toggleProductSelection(product)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <Badge className={categoryColors[product.category]}>
                      {product.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Interest Rate:</span>
                    <span className="font-semibold text-blue-600">{product.interestRate.default}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">{product.amount.currency} {product.amount.min.toLocaleString()} - {product.amount.max.toLocaleString()}</span>
                  </div>
                  <Button 
                    className="w-full mt-3"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      'Select to Compare'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
