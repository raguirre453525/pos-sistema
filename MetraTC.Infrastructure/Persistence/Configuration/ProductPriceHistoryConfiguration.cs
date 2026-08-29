using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class ProductPriceHistoryConfiguration : IEntityTypeConfiguration<ProductPriceHistory>
{
    public void Configure(EntityTypeBuilder<ProductPriceHistory> builder)
    {
        builder.ToTable("ProductPriceHistories");
        builder.HasKey(p => p.Id);
        builder.HasOne(p => p.Product)
            .WithMany()
            .HasForeignKey(p => p.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Property(p => p.OldPrice)
            .HasColumnType("decimal(18,2)")
            .IsRequired();
        builder.Property(p => p.NewPrice)
            .HasColumnType("decimal(18,2)")
            .IsRequired();
        builder.Property(p => p.ChangedAt)
            .IsRequired();
        builder.Property(p => p.Reason)
            .HasMaxLength(500);
        builder.HasIndex(p => new { p.ProductId, p.ChangedAt });
    }
}
