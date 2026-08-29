using MetraTC.Domain.Entities;
using MetraTC.Domain.Enums;
using MetraTC.Domain.Interfaces;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace MetraTC.Infrastructure.Repositories;

public class SalesRepository : ISalesRepository
{
    private readonly ApplicationDbContext _context;

    public SalesRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Sale> CreateAsync(List<(Guid productId, int quantity)> items, PaymentMethod paymentMethod, Guid? createdBy = null, Guid? customerId = null, bool isCredit = false)
    {
        if (items == null || !items.Any())
            throw new ArgumentException("La venta debe tener al menos un item", nameof(items));

        if (!Enum.IsDefined(typeof(PaymentMethod), paymentMethod))
            throw new ArgumentException("Método de pago inválido", nameof(paymentMethod));

        foreach (var (_, qty) in items)
        {
            if (qty <= 0)
                throw new ArgumentException("La cantidad debe ser mayor a cero", nameof(items));
        }

        foreach (var (pid, _) in items)
        {
            if (pid == Guid.Empty)
                throw new ArgumentException("El ProductId es obligatorio", nameof(items));
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var productIds = items.Select(i => i.productId).Distinct().ToList();

        // ORDER BY Id para evitar deadlock en concurrentes
        var products = await _context.Products
            .Where(p => productIds.Contains(p.Id))
            .OrderBy(p => p.Id)
            .ToListAsync();

        // Validar existencia / activo (HasQueryFilter IsActive oculta inactivos, por lo que fallará también)
        // Para mensaje explícito, verificamos que todos los IDs estén presentes
        var productDict = products.ToDictionary(p => p.Id);

        // Detectar producto faltante o inactivo: si Count != distinct, alguno no existe o está inactivo
        if (productDict.Count != productIds.Count)
        {
            var missing = productIds.First(id => !productDict.ContainsKey(id));
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {missing}");
        }

        // Agrupar cantidades por productId en caso de duplicados en request
        var grouped = items
            .GroupBy(x => x.productId)
            .Select(g => (productId: g.Key, quantity: g.Sum(v => v.quantity)))
            .ToList();

        // Validar stock y aplicar ajuste
        foreach (var (productId, quantity) in grouped)
        {
            var product = productDict[productId];
            if (product.Stock < quantity)
                throw new ArgumentException($"Stock insuficiente para el producto {product.Sku}. Disponible: {product.Stock}, solicitado: {quantity}");

            product.AdjustStock(-quantity);
        }

        // Snapshot UnitPrice server-side
        var saleItems = grouped.Select(g =>
        {
            var product = productDict[g.productId];
            return new SaleItem(g.productId, g.quantity, product.Price);
        }).ToList();

        if (isCredit)
        {
            if (customerId == null || customerId == Guid.Empty)
                throw new ArgumentException("Cliente requerido para venta fiada", nameof(customerId));
            var customerExists = await _context.Customers.AnyAsync(c => c.Id == customerId.Value);
            if (!customerExists) throw new KeyNotFoundException($"No se encontró cliente con ID: {customerId}");
        }

        var sale = new Sale(paymentMethod, saleItems, customerId, isCredit);

        _context.Sales.Add(sale);

        // Auditoría opcional por línea — reutiliza StockAdjustmentAudit
        foreach (var (productId, quantity) in grouped)
        {
            var product = productDict[productId];
            var audit = new StockAdjustmentAudit(product, -quantity, product.Stock, $"Sale {sale.Id}");
            _context.StockAdjustmentAudits.Add(audit);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        // Cargar navegación Product para mapping Sku/Name
        await _context.Entry(sale).Collection(s => s.Items).LoadAsync();
        foreach (var si in sale.Items)
        {
            await _context.Entry(si).Reference(x => x.Product).LoadAsync();
        }

        return sale;
    }

    public async Task<Sale?> GetByIdAsync(Guid id)
    {
        return await _context.Sales
            .IgnoreQueryFilters()
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<IEnumerable<Sale>> GetAllAsync()
    {
        return await _context.Sales
            .IgnoreQueryFilters()
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .OrderByDescending(s => s.Date)
            .ToListAsync();
    }
}
