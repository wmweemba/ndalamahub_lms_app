import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/utils/api';
import { getCurrentUser, canManageProducts } from '@/utils/roleUtils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { CreateProductDialog } from '@/components/products/CreateProductDialog';
import { EditProductDialog } from '@/components/products/EditProductDialog';
import { formatCurrency, formatTerm, formatRateBasis } from '@/lib/format';

const CATEGORIES = [
  { value: 'all', label: 'All products' },
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'payday', label: 'Payday' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'microfinance', label: 'Microfinance' },
  { value: 'auto', label: 'Auto' },
  { value: 'education', label: 'Education' },
  { value: 'mortgage', label: 'Mortgage' },
];

const METHOD_TINT = {
  reducing_balance: 'bg-status-info-bg text-status-info-fg',
  flat_rate: 'bg-status-success-bg text-status-success-fg',
  simple_interest: 'bg-status-warning-bg text-status-warning-fg',
  interest_only: 'bg-[#F0F0EE] text-[#5F5E5A]',
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLender, setSelectedLender] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['products', selectedCategory, selectedLender],
    queryFn: async () => {
      const params = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedLender !== 'all') params.company = selectedLender;
      const res = await api.get('/products', { params });
      return res.data.data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await api.get('/companies');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: currentUser?.role === 'platform_admin',
  });

  const lenders = useMemo(() => companies.filter((c) => c.type === 'lender'), [companies]);

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/products/${productId}`);
      toast.success('Product deleted');
      invalidateProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  if (isLoading) return <div className="p-4 md:p-8 text-sm text-muted-foreground">Loading products...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-[22px] font-medium text-foreground">Loan products</h1>
        {canManageProducts(currentUser?.role) && (
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create product
          </Button>
        )}
      </div>

      {error ? (
        <div className="bg-status-danger-bg text-status-danger-fg rounded-2xl p-4 mb-6 text-sm">
          Failed to load products
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-64">
          <Label htmlFor="category-filter" className="text-sm font-medium mb-2 block">
            Category
          </Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger id="category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentUser?.role === 'platform_admin' && (
          <div className="w-full sm:w-64">
            <Label htmlFor="lender-filter" className="text-sm font-medium mb-2 block">
              Lender
            </Label>
            <Select value={selectedLender} onValueChange={setSelectedLender} disabled={lenders.length === 0}>
              <SelectTrigger id="lender-filter">
                <SelectValue placeholder={lenders.length === 0 ? 'Loading lenders...' : undefined} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lenders ({lenders.length})</SelectItem>
                {lenders.map((lender) => (
                  <SelectItem key={lender._id} value={lender._id}>
                    {lender.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <h3 className="text-sm font-medium text-foreground">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCategory === 'all'
              ? 'No loan products available yet.'
              : `No ${selectedCategory} products found. Try a different category.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product._id}
              className="bg-card rounded-2xl border border-border p-4"
            >
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-[15px] font-medium text-foreground">
                    {product.name}
                  </h3>
                  {canManageProducts(currentUser?.role) && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-1 hover:bg-muted rounded-md"
                        title="Edit product"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="p-1 hover:bg-status-danger-bg rounded-md"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4 text-status-danger-fg" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-info-bg text-status-info-fg capitalize">
                    {product.category}
                  </span>
                  {product.company && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#F0F0EE] text-[#5F5E5A]">
                      {product.company.name}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {product.description}
              </p>

              <div className="space-y-2 mb-4 text-sm">
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
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrency(product.amount.min)} – {formatCurrency(product.amount.max)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Term range</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatTerm(product.term.min, product.term.unit)} – {formatTerm(product.term.max, product.term.unit)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    METHOD_TINT[product.interestCalculation.method] || 'bg-[#F0F0EE] text-[#5F5E5A]'
                  }`}
                >
                  {product.interestCalculation.method.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-6 text-sm text-muted-foreground text-center">
          Showing {products.length} product{products.length !== 1 ? 's' : ''}
        </div>
      )}

      <CreateProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          toast.success('Product created');
          invalidateProducts();
          setCreateDialogOpen(false);
        }}
      />

      <EditProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        product={selectedProduct}
        onSuccess={() => {
          toast.success('Product updated');
          invalidateProducts();
          setEditDialogOpen(false);
        }}
      />
    </div>
  );
}

export default ProductsPage;
