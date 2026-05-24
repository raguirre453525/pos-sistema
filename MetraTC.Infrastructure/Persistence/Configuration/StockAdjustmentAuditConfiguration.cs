using MetraTC.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MetraTC.Infrastructure.Persistence.Configurations;

public class StockAdjustmentAuditConfiguration : IEntityTypeConfiguration<StockAdjustmentAudit>
{
    public void Configure(EntityTypeBuilder<StockAdjustmentAudit> builder)
    {
        builder.ToTable("StockAdjustmentAudits");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Reason)
            .HasMaxLength(250)
            .IsRequired();
        builder.Property(a => a.AdjustedAt)
            .IsRequired();
        builder.HasIndex(a => new { a.ProductId, a.AdjustedAt });
    }
}
