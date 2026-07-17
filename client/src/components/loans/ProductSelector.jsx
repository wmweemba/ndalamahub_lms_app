import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { formatCurrency, formatTerm, formatRateBasis } from '@/lib/format';
import { Shield, CheckCircle2 } from 'lucide-react';

const CATEGORY_LABEL = {
  personal: 'Personal',
  business: 'Business',
  payday: 'Payday',
  bridge: 'Bridge',
  microfinance: 'Microfinance',
  auto: 'Auto',
  education: 'Education',
  mortgage: 'Mortgage',
  other: 'Other',
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
      const response = await api.get('/products/available');
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const filteredProducts = filter === 'all' ? products : products.filter((p) => p.category === filter);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground text-center">Loading products…</div>;
  }

  if (error) {
    return <div className="p-4 bg-status-danger-bg text-status-danger-fg rounded-2xl text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(cat)}
            className="capitalize"
          >
            {cat === 'all' ? 'All' : CATEGORY_LABEL[cat] || cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => {
          const isSelected = selectedProduct?._id === product._id;
          return (
            <button
              key={product._id}
              type="button"
              onClick={() => onSelect(product)}
              className={`text-left rounded-2xl border p-4 transition-colors ${
                isSelected ? 'border-nh-sage bg-accent' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-medium text-foreground">{product.name}</h3>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-info-bg text-status-info-fg capitalize">
                  {CATEGORY_LABEL[product.category] || product.category}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatRateBasis(
                      product.interestRate.default,
                      product.interestCalculation.method,
                      product.interestCalculation.rateBasis
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount range</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(product.amount.min)} – {formatCurrency(product.amount.max)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term range</span>
                  <span className="font-mono text-foreground">
                    {formatTerm(product.term.min, product.term.unit)} – {formatTerm(product.term.max, product.term.unit)}
                  </span>
                </div>
              </div>

              {product.collateralRequired && (
                <div className="flex items-center gap-2 text-xs text-status-warning-fg mt-3">
                  <Shield className="h-3.5 w-3.5" />
                  Collateral required
                </div>
              )}

              {product.marketingInfo?.highlights?.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border space-y-1">
                  {product.marketingInfo.highlights.slice(0, 3).map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-status-success-fg flex-shrink-0" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              )}

              {isSelected && (
                <div className="mt-3 text-xs font-medium text-foreground">Selected</div>
              )}
            </button>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">No products available in this category</div>
      )}
    </div>
  );
}
