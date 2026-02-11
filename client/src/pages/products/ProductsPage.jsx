import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { getCurrentUser, canManageProducts } from '@/utils/roleUtils';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { CreateProductDialog } from '@/components/products/CreateProductDialog';
import { EditProductDialog } from '@/components/products/EditProductDialog';

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLender, setSelectedLender] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const currentUser = getCurrentUser();

  const categories = [
    { value: 'all', label: 'All Products' },
    { value: 'personal', label: 'Personal' },
    { value: 'business', label: 'Business' },
    { value: 'payday', label: 'Payday' },
    { value: 'bridge', label: 'Bridge' },
    { value: 'microfinance', label: 'Microfinance' },
    { value: 'auto', label: 'Auto' },
    { value: 'education', label: 'Education' },
    { value: 'mortgage', label: 'Mortgage' },
  ];

  useEffect(() => {
    if (currentUser?.role === 'super_user') {
      fetchLenders();
    }
  }, []); // Run once on mount

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedLender]);

  const fetchLenders = async () => {
    try {
      const response = await api.get('/companies');
      console.log('Companies response:', response.data);
      
      // Filter for lender companies only
      const lenderCompanies = (response.data || []).filter(c => c.type === 'lender');
      console.log('Lender companies found:', lenderCompanies);
      
      setLenders(lenderCompanies);
    } catch (err) {
      console.error('Error fetching lenders:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (selectedLender !== 'all') {
        params.company = selectedLender;
      }
      
      console.log('Fetching products with params:', params);
      console.log('Selected lender ID:', selectedLender);
      
      const response = await api.get('/products', { params });
      
      console.log('Products response:', response.data);
      console.log('Number of products:', response.data.data?.length);
      
      setProducts(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      fetchProducts(); // Refresh list
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const getMethodBadgeColor = (method) => {
    const colors = {
      'reducing_balance': 'bg-blue-100 text-blue-800',
      'flat_rate': 'bg-green-100 text-green-800',
      'simple_interest': 'bg-yellow-100 text-yellow-800',
      'interest_only': 'bg-purple-100 text-purple-800',
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Products</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse and manage loan product offerings
          </p>
        </div>
        {canManageProducts(currentUser?.role) && (
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Product
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lender Filter (Super User Only) */}
      {currentUser?.role === 'super_user' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Lender
          </label>
          <select
            value={selectedLender}
            onChange={(e) => setSelectedLender(e.target.value)}
            disabled={lenders.length === 0}
            className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="all">
              {lenders.length === 0 ? 'Loading lenders...' : `All Lenders (${lenders.length})`}
            </option>
            {lenders.map((lender) => (
              <option key={lender._id} value={lender._id}>
                {lender.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
          <p className="mt-1 text-sm text-gray-500">
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
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  {canManageProducts(currentUser?.role) && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit product"
                      >
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 capitalize">
                    {product.category}
                  </span>
                  {product.company && (
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                      {product.company.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {product.description}
              </p>

              {/* Key Details */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Interest Rate:</span>
                  <span className="font-medium text-gray-900">
                    {product.interestRate.min}% - {product.interestRate.max}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Range:</span>
                  <span className="font-medium text-gray-900">
                    K{product.amount.min.toLocaleString()} - K{product.amount.max.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Term:</span>
                  <span className="font-medium text-gray-900">
                    {product.term.min} - {product.term.max} months
                  </span>
                </div>
              </div>

              {/* Calculation Method */}
              <div className="pt-4 border-t border-gray-200">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMethodBadgeColor(product.interestCalculation.method)}`}>
                  {product.interestCalculation.method.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products Count */}
      {products.length > 0 && (
        <div className="mt-6 text-sm text-gray-600 text-center">
          Showing {products.length} product{products.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Create Product Dialog */}
      <CreateProductDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchProducts();
          setCreateDialogOpen(false);
        }}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog 
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        product={selectedProduct}
        onSuccess={() => {
          fetchProducts();
          setEditDialogOpen(false);
        }}
      />
    </div>
  );
}

export default ProductsPage;
