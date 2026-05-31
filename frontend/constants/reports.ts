export type ReportSale = {
  id: string;
  cliente: string;
  total: number;
  fecha: string;
  tipoDePago: string;
  cantidadProductos: number;
};

export const MOCK_REPORTS = [
  {
    id: "SALE-001",
    cliente: "Juan Pérez",
    total: 15000,
    fecha: "2026-05-28",
    tipoDePago: "Efectivo",
    cantidadProductos: 3,
  },
  {
    id: "SALE-002",
    cliente: "María García",
    total: 45000,
    fecha: "2026-05-29",
    tipoDePago: "Transferencia",
    cantidadProductos: 5,
  },
  {
    id: "SALE-003",
    cliente: "Carlos López",
    total: 12000,
    fecha: "2026-05-29",
    tipoDePago: "Tarjeta",
    cantidadProductos: 2,
  },
  {
    id: "SALE-004",
    cliente: "Ana Martínez",
    total: 8500,
    fecha: "2026-05-30",
    tipoDePago: "Efectivo",
    cantidadProductos: 1,
  },
  {
    id: "SALE-005",
    cliente: "Luis Rodríguez",
    total: 120000,
    fecha: "2026-05-30",
    tipoDePago: "Transferencia",
    cantidadProductos: 12,
  },
];

export const REPORTS_STATS = {
  ventasTotales: MOCK_REPORTS.length,
  ingresosTotales: MOCK_REPORTS.reduce((acc, curr) => acc + curr.total, 0),
  productosVendidos: MOCK_REPORTS.reduce((acc, curr) => acc + curr.cantidadProductos, 0),
};
