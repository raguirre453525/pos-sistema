using FluentValidation;
using static MetraTC.Application.DTOs.PromotionDtos;
using MetraTC.Domain.Entities;

namespace MetraTC.Application.Validators.Promotion;

public class CreatePromotionDtoValidator : AbstractValidator<CreatePromotionDto>
{
    public CreatePromotionDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(3, 80);
        RuleFor(x => x.Description).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.Description));
        RuleFor(x => x.ComboPrice).GreaterThan(0).When(x => x.Type == PromotionType.Combo).WithMessage("ComboPrice debe ser > 0");
        RuleFor(x => x.DiscountPercentage).InclusiveBetween(1, 90).When(x => x.Type == PromotionType.Percentage);
        RuleFor(x => x.ValidTo).GreaterThanOrEqualTo(x => x.ValidFrom).When(x => x.ValidFrom.HasValue && x.ValidTo.HasValue);
        RuleFor(x => x.ProductIds).NotEmpty().WithMessage("Debe incluir productos");
        RuleFor(x => x.ProductIds).Must(ids => ids == null || ids.Distinct().Count() >= 2).When(x => x.Type == PromotionType.Combo).WithMessage("Combo requiere al menos 2 productos");
        RuleFor(x => x.ProductIds).Must(ids => ids != null && ids.Count >= 1).When(x => x.Type == PromotionType.Percentage);
    }
}
public class UpdatePromotionDtoValidator : AbstractValidator<UpdatePromotionDto>
{
    public UpdatePromotionDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(3, 80);
        RuleFor(x => x.Description).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.Description));
        RuleFor(x => x.ComboPrice).GreaterThan(0).When(x => x.Type == PromotionType.Combo);
        RuleFor(x => x.DiscountPercentage).InclusiveBetween(1, 90).When(x => x.Type == PromotionType.Percentage);
        RuleFor(x => x.ValidTo).GreaterThanOrEqualTo(x => x.ValidFrom).When(x => x.ValidFrom.HasValue && x.ValidTo.HasValue);
        RuleFor(x => x.ProductIds).NotEmpty();
        RuleFor(x => x.ProductIds).Must(ids => ids.Distinct().Count() >= 2).When(x => x.Type == PromotionType.Combo).WithMessage("Combo requiere al menos 2 productos");
    }
}
