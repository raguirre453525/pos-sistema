using FluentValidation;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static MetraTC.Application.DTOs.CategoryDtos;

namespace MetraTC.Application.Validators.Category;

public class CreateCategoryDtoValidator : AbstractValidator<CreateCategoryDto>
{
    public CreateCategoryDtoValidator(ApplicationDbContext db)
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("El nombre es requerido")
            .MaximumLength(100).WithMessage("El nombre no puede exceder los 100 caracteres")
            .MustAsync(async (name, ct) =>
                !await db.Categories.AnyAsync(c => c.IsActive && c.Name.ToLower() == name.ToLower(), ct))
            .WithMessage("Ya existe una categoría activa con ese nombre");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("La descripción no puede exceder los 500 caracteres")
            .When(x => !string.IsNullOrWhiteSpace(x.Description));
    }
}
