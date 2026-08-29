using MetraTC.Domain.Common;
using MetraTC.Domain.Entities;

namespace MetraTC.Domain.Entities;

/// <summary>
/// Resumen de combo vendido para historial. Ver ADR: Sale tiene SalePromotions (qué combos se vendieron) + SaleItems con PromotionId para stock/trazabilidad por componente.
/// Alternativa evaluada: solo SaleItem.PromotionId sin tabla resumen — insuficiente para mostrar "Combo x2 — $5.500" expandible sin recomputar. Se implementan ambas.
/// </summary>
public class SalePromotion : BaseEntity
{
    public Guid SaleId { get; private set; }
    public Sale Sale { get; private set; } = null!;
    public Guid PromotionId { get; private set; }
    public string PromotionName { get; private set; } = null!; // snapshot
    public PromotionType Type { get; private set; }
    public int Quantity { get; private set; } // cantidad de combos vendidos
    public decimal UnitPrice { get; private set; } // ComboPrice o precio con dto
    public decimal TotalOriginal { get; private set; }
    public decimal TotalPaid { get; private set; }
    public decimal Saving { get; private set; }

    private SalePromotion() : base() { }

    public SalePromotion(Guid promotionId, string promotionName, PromotionType type, int quantity, decimal unitPrice, decimal totalOriginal)
    {
        if (promotionId == Guid.Empty) throw new ArgumentException("PromotionId requerido", nameof(promotionId));
        if (string.IsNullOrWhiteSpace(promotionName)) throw new ArgumentException("PromotionName requerido", nameof(promotionName));
        if (quantity < 1) throw new ArgumentException("Quantity >=1", nameof(quantity));
        if (unitPrice < 0) throw new ArgumentException("UnitPrice >=0", nameof(unitPrice));
        PromotionId = promotionId;
        PromotionName = promotionName.Trim();
        Type = type;
        Quantity = quantity;
        UnitPrice = unitPrice;
        TotalOriginal = totalOriginal;
        TotalPaid = unitPrice * quantity;
        Saving = totalOriginal * quantity - TotalPaid;
        if (Saving < 0) Saving = 0;
    }

    internal void SetSale(Sale sale)
    {
        Sale = sale ?? throw new ArgumentNullException(nameof(sale));
        SaleId = sale.Id;
    }
}
