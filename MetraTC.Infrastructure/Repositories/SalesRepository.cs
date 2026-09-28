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

    public async Task<Sale> CreateAsync(Guid businessId, List<(Guid productId, decimal quantity)> items, PaymentMethod paymentMethod, Guid? createdBy = null, Guid? customerId = null, bool isCredit = false, DateTime? dueDate = null, List<(Guid promotionId, int quantity)>? combos = null)
    {
        var hasItems = items != null && items.Any();
        var hasCombos = combos != null && combos.Any();
        if (!hasItems && !hasCombos)
            throw new ArgumentException("La venta debe tener al menos un item", nameof(items));

        if (!Enum.IsDefined(typeof(PaymentMethod), paymentMethod))
            throw new ArgumentException("Método de pago inválido", nameof(paymentMethod));

        if (hasItems)
        {
            foreach (var (_, qty) in items!)
            {
                if (qty <= 0)
                    throw new ArgumentException("La cantidad debe ser mayor a cero", nameof(items));
                if (decimal.Round(qty, 3) != qty)
                    throw new ArgumentException("La cantidad no puede tener más de 3 decimales", nameof(items));
            }
            foreach (var (pid, _) in items!)
            {
                if (pid == Guid.Empty)
                    throw new ArgumentException("El ProductId es obligatorio", nameof(items));
            }
        }
        if (hasCombos)
        {
            foreach (var (pid, qty) in combos!)
            {
                if (pid == Guid.Empty) throw new ArgumentException("PromotionId requerido", nameof(combos));
                if (qty < 1 || qty > 99) throw new ArgumentException("Cantidad combo 1..99", nameof(combos));
            }
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        // Resolver promos combo
        List<Promotion> comboPromos = new();
        Dictionary<Guid, Promotion> promoDict = new();
        List<SalePromotion> salePromotions = new();
        List<(Guid productId, decimal quantity, Guid promotionId, string promotionName)> comboComponents = new();
        decimal comboTotalPaid = 0;
        decimal comboTotalOriginal = 0;
        if (hasCombos)
        {
            var promoIds = combos!.Select(c => c.promotionId).Distinct().ToList();
            comboPromos = await _context.Promotions.Include(p => p.Lines).ThenInclude(l => l.Product).Where(p => promoIds.Contains(p.Id)).IgnoreQueryFilters().ToListAsync();
            promoDict = comboPromos.ToDictionary(p => p.Id);
            if (promoDict.Count != promoIds.Count)
            {
                var missing = promoIds.First(id => !promoDict.ContainsKey(id));
                throw new KeyNotFoundException($"No se encontró promoción con ID: {missing}");
            }
            var now = DateTime.UtcNow;
            foreach (var (pid, qty) in combos!)
            {
                var promo = promoDict[pid];
                if (!promo.IsCurrentlyActive(now)) throw new ArgumentException($"Promoción no activa: {promo.Name}", nameof(combos));
                if (promo.Type != PromotionType.Combo) throw new ArgumentException($"Promoción {promo.Name} no es tipo Combo — usa items normales con precio descontado", nameof(combos));
                if (!promo.ComboPrice.HasValue) throw new ArgumentException($"Promoción {promo.Name} sin ComboPrice", nameof(combos));
            }
            // Agrupar combos por promo para SalePromotion resumen
            var groupedCombos = combos!.GroupBy(c => c.promotionId).Select(g => (promotionId: g.Key, quantity: g.Sum(x => x.quantity))).ToList();
            foreach (var (promoId, qty) in groupedCombos)
            {
                var promo = promoDict[promoId];
                var totalOriginalPerUnit = promo.Lines.Sum(l => (l.Product?.Price ?? 0) * l.Quantity);
                // Fallback: si navegación Product no cargada (por precio), cargar desde Products
                if (totalOriginalPerUnit == 0)
                {
                    var prodIds = promo.Lines.Select(l => l.ProductId).ToList();
                    var prods = await _context.Products.Where(p => prodIds.Contains(p.Id)).ToListAsync();
                    var pdict = prods.ToDictionary(p => p.Id);
                    totalOriginalPerUnit = promo.Lines.Sum(l => (pdict.TryGetValue(l.ProductId, out var pr) ? pr.Price : 0) * l.Quantity);
                }
                var sp = new SalePromotion(promoId, promo.Name, promo.Type, qty, promo.ComboPrice!.Value, totalOriginalPerUnit);
                salePromotions.Add(sp);
                comboTotalPaid += sp.TotalPaid;
                comboTotalOriginal += sp.TotalOriginal * qty; // TotalOriginal es por unidad, pero SP ya guarda Saving correctamente? ajustar
                foreach (var line in promo.Lines)
                {
                    comboComponents.Add((line.ProductId, line.Quantity * qty, promoId, promo.Name));
                }
            }
            // Corrección comboTotalOriginal: sumamos por qty ya en Saving; recalcular
            comboTotalOriginal = salePromotions.Sum(sp => sp.TotalOriginal * sp.Quantity);
        }

        // Construir lista de productos afectados: items + comboComponents
        var allProductIds = new List<Guid>();
        if (hasItems) allProductIds.AddRange(items!.Select(i => i.productId));
        if (comboComponents.Any()) allProductIds.AddRange(comboComponents.Select(c => c.productId));
        allProductIds = allProductIds.Distinct().ToList();

        var products = allProductIds.Any() ? await _context.Products.Where(p => allProductIds.Contains(p.Id) && p.BusinessId == businessId).OrderBy(p => p.Id).ToListAsync() : new List<Product>();
        var productDict = products.ToDictionary(p => p.Id);
        if (productDict.Count != allProductIds.Count)
        {
            var missing = allProductIds.First(id => !productDict.ContainsKey(id));
            throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {missing}");
        }

        // Agrupar cantidades totales por producto (items + componentes combo)
        var groupedTotals = new Dictionary<Guid, decimal>();
        if (hasItems)
        {
            foreach (var g in items!.GroupBy(x => x.productId).Select(g => (productId: g.Key, quantity: g.Sum(v => v.quantity))))
            {
                groupedTotals[g.productId] = groupedTotals.TryGetValue(g.productId, out var cur) ? cur + g.quantity : g.quantity;
            }
        }
        foreach (var cc in comboComponents)
        {
            groupedTotals[cc.productId] = groupedTotals.TryGetValue(cc.productId, out var cur) ? cur + cc.quantity : cc.quantity;
        }
        var grouped = groupedTotals.Select(kv => (productId: kv.Key, quantity: kv.Value)).ToList();

        // Validar modo de venta (un => entero, kg => decimal 3) y stock
        foreach (var (productId, quantity) in grouped)
        {
            var product = productDict[productId];
            if (!product.IsSoldByWeight)
            {
                // Por unidad: debe ser entero
                if (quantity != Math.Truncate(quantity))
                    throw new ArgumentException($"El producto {product.Sku} se vende por unidad: la cantidad debe ser entera (recibido {quantity})", nameof(items));
            }
            else
            {
                if (decimal.Round(quantity, 3) != quantity)
                    throw new ArgumentException($"El producto {product.Sku} se vende a granel: máximo 3 decimales", nameof(items));
            }
            if (product.Stock < quantity)
                throw new ArgumentException($"Stock insuficiente para el producto {product.Sku}. Disponible: {product.Stock}, solicitado: {quantity}");
            product.AdjustStock(-quantity);
        }

        // Crear SaleItems: normales con precio, combo con UnitPrice 0 y PromotionId para trazabilidad
        var saleItems = new List<SaleItem>();
        if (hasItems)
        {
            foreach (var g in items!.GroupBy(x => x.productId).Select(g => (productId: g.Key, quantity: g.Sum(v => v.quantity))))
            {
                var product = productDict[g.productId];
                saleItems.Add(new SaleItem(g.productId, g.quantity, product.Price));
            }
        }
        // Combo items: cada componente como SaleItem con UnitPrice 0 y PromotionId
        // Agrupar componentes por (productId, promotionId) para no duplicar filas idénticas
        var comboItemGroups = comboComponents.GroupBy(c => new { c.productId, c.promotionId, c.promotionName }).Select(g => (productId: g.Key.productId, promotionId: g.Key.promotionId, promotionName: g.Key.promotionName, quantity: g.Sum(x => x.quantity))).ToList();
        foreach (var cg in comboItemGroups)
        {
            saleItems.Add(new SaleItem(cg.productId, cg.quantity, 0, cg.promotionId, cg.promotionName));
        }

        if (isCredit)
        {
            if (customerId == null || customerId == Guid.Empty)
                throw new ArgumentException("Cliente requerido para venta fiada", nameof(customerId));
            var customerExists = await _context.Customers.AnyAsync(c => c.Id == customerId.Value);
            if (!customerExists) throw new KeyNotFoundException($"No se encontró cliente con ID: {customerId}");
        }

        decimal? forcedTotal = null;
        if (salePromotions.Any())
        {
            var itemsTotal = saleItems.Where(si => !si.IsFromCombo).Sum(si => si.Subtotal);
            forcedTotal = itemsTotal + comboTotalPaid;
        }
        var sale = new Sale(paymentMethod, saleItems, customerId, isCredit, dueDate, salePromotions.Any() ? salePromotions : null, forcedTotal);
        sale.BusinessId = businessId;

        _context.Sales.Add(sale);

        // Auditoría por producto
        foreach (var (productId, quantity) in grouped)
        {
            var product = productDict[productId];
            var audit = new StockAdjustmentAudit(product, -quantity, product.Stock, $"Sale {sale.Id}");
            _context.StockAdjustmentAudits.Add(audit);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        await _context.Entry(sale).Collection(s => s.Items).LoadAsync();
        foreach (var si in sale.Items) await _context.Entry(si).Reference(x => x.Product).LoadAsync();
        await _context.Entry(sale).Collection(s => s.SalePromotions).LoadAsync();

        return sale;
    }

    public async Task<Sale?> GetByIdAsync(Guid id, Guid businessId)
    {
        return await _context.Sales
            .IgnoreQueryFilters()
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .Include(s => s.SalePromotions)
            .FirstOrDefaultAsync(s => s.Id == id && s.BusinessId == businessId);
    }

    public async Task<IEnumerable<Sale>> GetAllAsync(Guid businessId)
    {
        return await _context.Sales
            .IgnoreQueryFilters()
            .Where(s => s.BusinessId == businessId)
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .Include(s => s.SalePromotions)
            .OrderByDescending(s => s.Date)
            .ToListAsync();
    }
}
