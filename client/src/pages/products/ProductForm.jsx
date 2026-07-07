import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ImagePlus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { getProduct, createProduct, updateProduct } from '@/services/productService';
import { getSuppliers } from '@/services/supplierService';
import { getAll, orderBy } from '@/services/firestore';
import { uploadProductImage, deleteImageByUrl } from '@/services/uploadService';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { SIZES, GENDERS, MATERIALS, COLORS } from '@/constants';

/** Add / Edit product form with image upload and full validation. */
export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [images, setImages] = useState([]);       // existing + uploaded URLs
  const [uploading, setUploading] = useState(false);

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '', sku: '', category: '', subCategory: '', brand: '', size: 'M',
      color: '', gender: 'Unisex', material: '', purchasePrice: '', sellingPrice: '',
      discountPrice: '', tax: 5, stockQuantity: 0, minStock: 10, supplierId: '',
      description: '',
    },
  });

  const selectedCategory = watch('category');
  const subCategories = categories.find((c) => c.name === selectedCategory)?.subCategories || [];

  useEffect(() => {
    (async () => {
      try {
        const [cats, sups] = await Promise.all([
          getAll('categories', orderBy('name')),
          getSuppliers(),
        ]);
        setCategories(cats);
        setSuppliers(sups);
        if (isEdit) {
          const product = await getProduct(id);
          if (!product) {
            toast.error('Product not found.');
            navigate('/products');
            return;
          }
          reset({
            ...product,
            discountPrice: product.discountPrice ?? '',
            supplierId: product.supplierId || '',
          });
          setImages(product.images || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load form data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate, reset]);

  const handleImageUpload = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > 5) {
      toast.warn('Maximum 5 images per product.');
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadProductImage(file, id || 'new');
        setImages((prev) => [...prev, url]);
      }
      toast.success('Image uploaded (compressed automatically).');
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (url) => {
    setImages((prev) => prev.filter((u) => u !== url));
    deleteImageByUrl(url); // fire-and-forget
  };

  const onSubmit = async (values) => {
    const data = {
      ...values,
      purchasePrice: Number(values.purchasePrice),
      sellingPrice: Number(values.sellingPrice),
      discountPrice: values.discountPrice ? Number(values.discountPrice) : null,
      tax: Number(values.tax) || 0,
      stockQuantity: Number(values.stockQuantity) || 0,
      minStock: Number(values.minStock) || 10,
      supplierId: values.supplierId || null,
      images,
    };
    if (data.discountPrice && data.discountPrice >= data.sellingPrice) {
      toast.error('Discount price must be lower than the selling price.');
      return;
    }
    try {
      if (isEdit) {
        await updateProduct(id, data);
        toast.success('Product updated.');
      } else {
        await createProduct(data);
        toast.success('Product created — QR code generated from its SKU.');
      }
      navigate('/products');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Save failed.');
    }
  };

  if (loading) return <PageLoader label="Loading product…" />;

  const num = (opts = {}) => ({ valueAsNumber: false, ...opts });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl space-y-4" noValidate>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/products"><Button type="button" variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-xl font-semibold">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
            <p className="text-sm text-ink/50">{isEdit ? 'Update details — the QR code stays tied to the SKU.' : 'A unique SKU + QR code is generated automatically.'}</p>
          </div>
        </div>
        <Button type="submit" variant="gold" loading={isSubmitting}>{isEdit ? 'Save Changes' : 'Create Product'}</Button>
      </div>

      <Card>
        <CardHeader title="Basic information" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product name" required error={errors.name?.message} className="sm:col-span-2">
            <Input placeholder="e.g. Classic Black Crew Neck T-Shirt" error={errors.name}
              {...register('name', { required: 'Product name is required.', minLength: { value: 3, message: 'At least 3 characters.' } })} />
          </Field>
          <Field label="SKU (leave blank to auto-generate)" error={errors.sku?.message}>
            <Input placeholder="VLR-TSH-1234" {...register('sku')} disabled={isEdit} />
          </Field>
          <Field label="Category" required error={errors.category?.message}>
            <Select error={errors.category} {...register('category', { required: 'Category is required.' })}>
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Sub category">
            <Select {...register('subCategory')}>
              <option value="">—</option>
              {subCategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Brand">
            <Input placeholder="e.g. Veloura Signature" {...register('brand')} />
          </Field>
          <Field label="Size">
            <Select {...register('size')}>{SIZES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Color">
            <Select {...register('color')}>
              <option value="">—</option>
              {COLORS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Gender">
            <Select {...register('gender')}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select>
          </Field>
          <Field label="Material">
            <Select {...register('material')}>
              <option value="">—</option>
              {MATERIALS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2 lg:col-span-3">
            <Textarea placeholder="Fabric, fit, care instructions…" {...register('description')} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pricing & stock" />
        <CardBody className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="Purchase price" required error={errors.purchasePrice?.message}>
            <Input type="number" min="0" step="1" error={errors.purchasePrice}
              {...register('purchasePrice', num({ required: 'Required.', min: { value: 0, message: 'Must be ≥ 0.' } }))} />
          </Field>
          <Field label="Selling price" required error={errors.sellingPrice?.message}>
            <Input type="number" min="0" step="1" error={errors.sellingPrice}
              {...register('sellingPrice', num({ required: 'Required.', min: { value: 1, message: 'Must be > 0.' } }))} />
          </Field>
          <Field label="Discount price (optional)">
            <Input type="number" min="0" step="1" {...register('discountPrice')} />
          </Field>
          <Field label="Tax %">
            <Input type="number" min="0" max="100" {...register('tax')} />
          </Field>
          <Field label="Stock quantity" required error={errors.stockQuantity?.message}>
            <Input type="number" min="0" error={errors.stockQuantity}
              {...register('stockQuantity', num({ required: 'Required.', min: { value: 0, message: 'Must be ≥ 0.' } }))} />
          </Field>
          <Field label="Minimum stock (alert level)">
            <Input type="number" min="0" {...register('minStock')} />
          </Field>
          <Field label="Supplier" className="col-span-2">
            <Select {...register('supplierId')}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Images" subtitle="Up to 5 — compressed automatically before upload" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {images.map((url) => (
              <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-ink/10">
                <img src={url} alt="product" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeImage(url)}
                  className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/15 text-ink/40 transition-colors hover:border-gold hover:text-gold-dark">
                <ImagePlus className="h-6 w-6" />
                <span className="text-[10px]">{uploading ? 'Uploading…' : 'Add image'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
