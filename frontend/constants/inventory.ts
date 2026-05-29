export interface InventoryItem {
  sku: string;
  name: string;
  image: string;
  category: string;
  stock: number;
  price: number;
}

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    sku: "PROD-001",
    name: "Producto A",
    image: "/img-prod.webp",
    category: "Electrónica",
    stock: 50,
    price: 1200,
  },
  {
    sku: "PROD-002",
    name: "Producto B",
    image: "/img-prod.webp",
    category: "Ropa",
    stock: 120,
    price: 850,
  },
  {
    sku: "PROD-003",
    name: "Producto C",
    image: "/img-prod.webp",
    category: "Hogar",
    stock: 15,
    price: 2100,
  },
  {
    sku: "PROD-004",
    name: "Producto D",
    image: "/img-prod.webp",
    category: "Alimentos",
    stock: 200,
    price: 400,
  },
  {
    sku: "PROD-005",
    name: "Producto E",
    image: "/img-prod.webp",
    category: "Electrónica",
    stock: 30,
    price: 1500,
  },
  {
    sku: "PROD-006",
    name: "Producto F",
    image: "/img-prod.webp",
    category: "Ropa",
    stock: 0,
    price: 600,
  },
  {
    sku: "PROD-007",
    name: "Producto G",
    image: "/img-prod.webp",
    category: "Hogar",
    stock: 85,
    price: 3000,
  },
  {
    sku: "PROD-008",
    name: "Producto H",
    image: "/img-prod.webp",
    category: "Alimentos",
    stock: 40,
    price: 1100,
  },
  {
    sku: "PROD-009",
    name: "Producto I",
    image: "/img-prod.webp",
    category: "Otros",
    stock: 10,
    price: 900,
  },
  {
    sku: "PROD-010",
    name: "Producto J",
    image: "/img-prod.webp",
    category: "Electrónica",
    stock: 65,
    price: 1800,
  },
];
