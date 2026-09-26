export const mockCategories = [
  {
    _id: 'cat-raw-materials',
    name: 'Raw Materials',
    parent: null,
    description: 'Unprocessed materials used in manufacturing',
  },
  {
    _id: 'cat-steel-products',
    name: 'Steel Products',
    parent: 'cat-raw-materials',
    description: 'Steel rods, sheets and pipes',
  },
  {
    _id: 'cat-fasteners',
    name: 'Fasteners & Hardware',
    parent: null,
    description: 'Nuts, bolts, screws and hardware components',
  },
  {
    _id: 'cat-furniture',
    name: 'Furniture',
    parent: null,
    description: 'Office and industrial furniture',
  },
  {
    _id: 'cat-packaging',
    name: 'Packaging Materials',
    parent: null,
    description: 'Boxes, crates and packaging supplies',
  },
]
