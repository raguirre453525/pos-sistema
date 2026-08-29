using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public enum PromotionType { Combo = 0, Percentage = 1 }

public class Promotion : BaseEntity
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public PromotionType Type { get; private set; }
    public DateTime? ValidFrom { get; private set; }
    public DateTime? ValidTo { get; private set; }
    public decimal? ComboPrice { get; private set; }
    public decimal? DiscountPercentage { get; private set; }
    public ICollection<Product> Products { get; private set; } = new List<Product>();

    // EF Core constructor
    private Promotion() : base() { }

    public Promotion(
        string name,
        PromotionType type,
        string? description,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        ICollection<Product> products)
    {
        Name = name?.Trim() ?? throw new ArgumentException("El nombre es obligatorio", nameof(name));
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
        ValidFrom = validFrom;
        ValidTo = validTo;
        ComboPrice = comboPrice;
        DiscountPercentage = discountPercentage;
        Products = products ?? new List<Product>();

        // sync IsActive via base methods
        if (isActive) Activate(); else Deactivate();

        Validate();
    }

    public void Update(
        string name,
        string? description,
        PromotionType type,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        ICollection<Product> products)
    {
        Name = name?.Trim() ?? throw new ArgumentException("El nombre es obligatorio", nameof(name));
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
        ValidFrom = validFrom;
        ValidTo = validTo;
        ComboPrice = comboPrice;
        DiscountPercentage = discountPercentage;
        Products = products ?? new List<Product>();

        if (isActive) Activate(); else Deactivate();

        Validate();
    }

    public void SetActive(bool v)
    {
        if (v) Activate(); else Deactivate();
    }

    public bool IsCurrentlyActive(DateTime now) =>
        IsActive && (ValidFrom == null || now >= ValidFrom) && (ValidTo == null || now <= ValidTo);

    private void Validate()
    {
        if (string.IsNullOrWhiteSpace(Name) || Name.Length < 3 || Name.Length > 80)
            throw new ArgumentException("El nombre debe tener entre 3 y 80 caracteres", nameof(Name));

        if (Description != null && Description.Length > 500)
            throw new ArgumentException("La descripción no puede exceder 500 caracteres", nameof(Description));

        if (ValidFrom.HasValue && ValidTo.HasValue && ValidTo.Value < ValidFrom.Value)
            throw new ArgumentException("La fecha Hasta no puede ser anterior a Desde", nameof(ValidTo));

        if (Type == PromotionType.Combo)
        {
            if (!ComboPrice.HasValue || ComboPrice.Value <= 0)
                throw new ArgumentException("El precio combo debe ser mayor a 0", nameof(ComboPrice));
            if (DiscountPercentage.HasValue)
                throw new ArgumentException("Descuento no aplica para combo", nameof(DiscountPercentage));
            if (Products == null || Products.Count < 2)
                throw new ArgumentException("Un combo debe tener al menos 2 productos", nameof(Products));
        }
        else // Percentage
        {
            if (!DiscountPercentage.HasValue || DiscountPercentage.Value < 1 || DiscountPercentage.Value > 90)
                throw new ArgumentException("El descuento debe estar entre 1 y 90", nameof(DiscountPercentage));
            if (ComboPrice.HasValue)
                throw new ArgumentException("Precio combo no aplica para descuento porcentual", nameof(ComboPrice));
            if (Products == null || Products.Count < 1)
                throw new ArgumentException("Una promo debe tener al menos 1 producto", nameof(Products));
        }
    }
}
