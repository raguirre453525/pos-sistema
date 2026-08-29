using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configuration;

public class SalePromotionConfiguration : IEntityTypeConfiguration<SalePromotion>
{
    public void Configure(EntityTypeBuilder<SalePromotion> builder)
    {
        builder.ToTable("SalePromotions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PromotionName).HasMaxLength(80).IsRequired();
        builder.Property(x => x.Type).IsRequired();
        builder.Property(x => x.Quantity).IsRequired();
        builder.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(x => x.TotalOriginal).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(x => x.TotalPaid).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(x => x.Saving).HasColumnType("decimal(18,2)").IsRequired();
        builder.HasOne(x => x.Sale).WithMany(s => s.SalePromotions).HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => x.SaleId);
        builder.HasIndex(x => x.PromotionId);
    }
}
