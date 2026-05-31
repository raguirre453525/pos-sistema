export interface Product {
  id: string;
  name: string;
  image: string;
  totalSales: number;
  category: string;
}

export const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Producto A", image: "/img-prod.webp", totalSales: 2100, category: "A" },
  { id: "2", name: "Producto B", image: "/img-prod.webp", totalSales: 1500, category: "B" },
  { id: "3", name: "Producto C", image: "/img-prod.webp", totalSales: 1200, category: "C" },
  { id: "4", name: "Producto D", image: "/img-prod.webp", totalSales: 850, category: "C" },
  { id: "5", name: "Producto E", image: "/img-prod.webp", totalSales: 400, category: "C" },
  
];


