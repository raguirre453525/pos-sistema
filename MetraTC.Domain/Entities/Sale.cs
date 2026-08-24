using MetraTC.Domain.Common;
using MetraTC.Domain.Enums;

namespace MetraTC.Domain.Entities;

public class Sale : BaseEntity
{
    public DateTime Date { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public decimal Total { get; private set; }
    public ICollection<SaleItem> Items { get; private set; } = new List<SaleItem>();

    private Sale()
    {
    }

    public Sale(PaymentMethod paymentMethod, IEnumerable<SaleItem> items)
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
        Total = itemList.Sum(i => i.Subtotal);
    }

    internal void AddItem(SaleItem item)
    {
        if (item == null) throw new ArgumentNullException(nameof(item));
        item.SetSale(this);
        ((List<SaleItem>)Items).Add(item);
        Total = Items.Sum(i => i.Subtotal);
    }
}
