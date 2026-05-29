export interface Product {
  id: string;
  name: string;
  image: string;
  totalSales: number;
  category: string;
}

export const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Producto A", image: "/img-prod.webp", totalSales: 1200, category: "A" },
  { id: "2", name: "Producto B", image: "/img-prod.webp", totalSales: 850, category: "B" },
  { id: "3", name: "Producto C", image: "/img-prod.webp", totalSales: 2100, category: "C" },
  { id: "4", name: "Producto D", image: "/img-prod.webp", totalSales: 400, category: "C" },
  { id: "5", name: "Producto E", image: "/img-prod.webp", totalSales: 1500, category: "C" },
  { id: "6", name: "Producto F", image: "/img-prod.webp", totalSales: 600, category: "C" },
  { id: "7", name: "Producto G", image: "/img-prod.webp", totalSales: 3000, category: "C" },
  { id: "8", name: "Producto H", image: "/img-prod.webp", totalSales: 1100, category: "C" },
  { id: "9", name: "Producto I", image: "/img-prod.webp", totalSales: 900, category: "C" },
  { id: "10", name: "Producto J", image: "/img-prod.webp", totalSales: 1800, category: "C" },
];


