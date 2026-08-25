using AutoMapper;
using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.CategoryDtos;

namespace MetraTC.Application.Mappings;

public class CategoryProfile : Profile
{
    public CategoryProfile()
    {
        CreateMap<Category, CategoryDto>()
            .ForMember(dest => dest.ProductCount, opt => opt.MapFrom(src => src.Products.Count(p => p.IsActive)));

        CreateMap<CreateCategoryDto, Category>()
            .ConstructUsing(src => new Category(src.Name, src.Description));

        CreateMap<UpdateCategoryDto, Category>();
    }
}
