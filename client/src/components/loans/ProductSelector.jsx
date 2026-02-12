import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/utils/api';
import { DollarSign, Calendar, TrendingUp, Shield, CheckCircle2, Info } from 'lucide-react';

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

export default function ProductSelector({ onSelect, selectedProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Use /available endpoint to get products from user's lender
      const response = await api.get('/products/available');
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (err) {
      setError('Failed to load products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(p => p.category === filter);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
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
        {filteredProducts.map(product => (
          <Card 
            key={product._id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedProduct?._id === product._id ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
            onClick={() => onSelect(product)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {product.description}
                  </CardDescription>
                </div>
                <Badge className={`${categoryColors[product.category]} capitalize ml-2`}>
                  {product.category}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Interest Rate */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>Interest Rate</span>
                </div>
                <span className="font-semibold text-blue-600">
                  {product.interestRate.default}% APR
                </span>
              </div>

              {/* Loan Amount */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  <span>Amount Range</span>
                </div>
                <span className="font-semibold">
                  {product.amount.currency} {product.amount.min.toLocaleString()} - {product.amount.max.toLocaleString()}
                </span>
              </div>

              {/* Loan Term */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Term</span>
                </div>
                <span className="font-semibold">
                  {product.term.min}-{product.term.max} months
                </span>
              </div>

              {/* Collateral */}
              {product.collateralRequired && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Shield className="h-4 w-4" />
                  <span>Collateral Required</span>
                </div>
              )}

              {/* Processing Fee */}
              {product.fees?.processingFee?.amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="h-4 w-4" />
                    <span>Processing Fee</span>
                  </div>
                  <span className="text-gray-700">
                    {product.fees.processingFee.type === 'percentage' 
                      ? `${product.fees.processingFee.amount}%`
                      : `${product.amount.currency} ${product.fees.processingFee.amount}`
                    }
                  </span>
                </div>
              )}

              {/* Highlights */}
              {product.marketingInfo?.highlights && product.marketingInfo.highlights.length > 0 && (
                <div className="pt-2 border-t space-y-1">
                  {product.marketingInfo.highlights.slice(0, 3).map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Select Button */}
              <Button 
                className="w-full mt-3"
                variant={selectedProduct?._id === product._id ? 'default' : 'outline'}
                size="sm"
              >
                {selectedProduct?._id === product._id ? 'Selected' : 'Select Product'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No products available in this category
        </div>
      )}
    </div>
  );
}
