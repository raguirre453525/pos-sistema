using MetraTC.Domain.Common;
using MetraTC.Domain.Enums;

namespace MetraTC.Domain.Entities;

public class Sale : BaseEntity
{
    public DateTime Date { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public decimal Total { get; private set; }
    public ICollection<SaleItem> Items { get; private set; } = new List<SaleItem>();
    // Historial combo: resumen por promoción vendida (visible como combo, no productos sueltos aislados)
    public ICollection<SalePromotion> SalePromotions { get; private set; } = new List<SalePromotion>();

    public Guid? CustomerId { get; private set; }
    public Customer? Customer { get; private set; }
    public bool IsCredit { get; private set; }
    public decimal PaidAmount { get; private set; }
    public DateTime? DueDate { get; private set; }
    public DateTime? PaidAt { get; private set; }

    private Sale()
    {
    }

    public Sale(PaymentMethod paymentMethod, IEnumerable<SaleItem> items, Guid? customerId = null, bool isCredit = false, DateTime? dueDate = null, IEnumerable<SalePromotion>? salePromotions = null, decimal? forcedTotal = null)
    {
        if (items == null || !items.Any())
            throw new ArgumentException("La venta debe tener al menos un item", nameof(items));

        if (!Enum.IsDefined(typeof(PaymentMethod), paymentMethod))
            throw new ArgumentException("Método de pago inválido", nameof(paymentMethod));

        PaymentMethod = paymentMethod;
        Date = DateTime.UtcNow;

        var itemList = items.ToList();
        foreach (var item in itemList)
        {
            item.SetSale(this);
        }

        Items = itemList;
        if (salePromotions != null)
        {
            var spList = salePromotions.ToList();
            foreach (var sp in spList) sp.SetSale(this);
            SalePromotions = spList;
        }
        // Si hay promos combo, el total real es forcedTotal (suma normal + comboPrice*qty), no suma de Items sueltos a precio 0
        Total = forcedTotal ?? itemList.Sum(i => i.Subtotal);

        if (isCredit)
        {
            if (customerId == null || customerId == Guid.Empty)
                throw new ArgumentException("Cliente requerido para venta fiada", nameof(customerId));
            CustomerId = customerId;
            IsCredit = true;
            PaidAmount = 0;
            if (dueDate.HasValue)
            {
                SetDueDate(dueDate);
            }
        }
        else
        {
            CustomerId = customerId;
            IsCredit = false;
            PaidAmount = Total;
            DueDate = null;
            PaidAt = DateTime.UtcNow;
        }
    }

    public void SetDueDate(DateTime? dueDate)
    {
        if (!IsCredit)
            throw new InvalidOperationException("Solo ventas fiadas pueden tener vencimiento");
        if (dueDate.HasValue)
        {
            var days = (dueDate.Value - DateTime.UtcNow).TotalDays;
            if (days < 0 || dueDate.Value < Date) // allow past? but validate range elsewhere
            {
                // allow but don't throw for past due; range validation done in service
            }
            DueDate = dueDate.Value;
        }
        else
        {
            DueDate = null;
        }
    }

    internal void AddItem(SaleItem item)
    {
        if (item == null) throw new ArgumentNullException(nameof(item));
        item.SetSale(this);
        ((List<SaleItem>)Items).Add(item);
        // No recalcular Total si hay SalePromotions (total incluye ComboPrice), caller debe ajustar
        if (!SalePromotions.Any())
            Total = Items.Sum(i => i.Subtotal);
    }

    internal void AddSalePromotion(SalePromotion sp)
    {
        if (sp == null) throw new ArgumentNullException(nameof(sp));
        sp.SetSale(this);
        ((List<SalePromotion>)SalePromotions).Add(sp);
    }

    public void RecalculateTotal(decimal comboTotal, decimal itemsTotal)
    {
        Total = comboTotal + itemsTotal;
        if (!IsCredit) PaidAmount = Total;
    }

    public void MarkAsCredit(Guid customerId)
    {
        if (customerId == Guid.Empty) throw new ArgumentException("Cliente requerido", nameof(customerId));
        CustomerId = customerId;
        IsCredit = true;
        PaidAmount = 0;
    }

    public void RegisterPayment(decimal amount)
    {
        if (amount <= 0) throw new ArgumentException("El monto debe ser mayor a 0", nameof(amount));
        if (!IsCredit) throw new InvalidOperationException("La venta no es fiada");
        var remaining = Total - PaidAmount;
        if (amount > remaining)
            throw new ArgumentException($"El monto excede el saldo pendiente (${remaining})", nameof(amount));
        PaidAmount += amount;
        if (PaidAmount >= Total)
        {
            PaidAmount = Total;
            IsCredit = false;
            PaidAt = DateTime.UtcNow;
        }
    }
}
