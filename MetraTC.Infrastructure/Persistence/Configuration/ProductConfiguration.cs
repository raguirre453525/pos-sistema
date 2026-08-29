using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Price)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(p => p.Stock)
            .HasColumnType("decimal(18,3)")
            .IsRequired()
            .HasDefaultValue(0m);

        builder.HasMany<StockAdjustmentAudit>()
            .WithOne(a => a.Product)
            .HasForeignKey(a => a.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(p => p.Name)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.Sku)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.Barcode)
            .HasMaxLength(100);

        builder.Property(p => p.Description)
            .HasMaxLength(200);

        builder.Property(p => p.ImageUrl)
            .HasMaxLength(500);

        builder.Property(p => p.Unit)
            .HasMaxLength(20)
            .HasComment("Modo de venta canónico: un (por unidad) o kg (a granel por peso)");

        builder.Property(p => p.MinStock)
            .HasColumnType("decimal(18,3)");

        builder.HasMany(p => p.Categories)
            .WithMany(c => c.Products)
            .UsingEntity(j => j.ToTable("ProductCategories"));

        builder.HasQueryFilter(d => d.IsActive);
    }
}
