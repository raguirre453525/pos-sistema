using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("Promotions");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).HasMaxLength(80).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(500);
        builder.Property(p => p.Type).IsRequired();
        builder.Property(p => p.ValidFrom).HasColumnType("datetime2");
        builder.Property(p => p.ValidTo).HasColumnType("datetime2");
        builder.Property(p => p.ComboPrice).HasColumnType("decimal(18,2)");
        builder.Property(p => p.DiscountPercentage).HasColumnType("decimal(5,2)");
        builder.Property(p => p.ImageUrl).HasMaxLength(500);
        builder.Ignore(p => p.Products);
        builder.HasMany(p => p.Lines).WithOne(l => l.Promotion).HasForeignKey(l => l.PromotionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasQueryFilter(p => p.IsActive);
    }
}
