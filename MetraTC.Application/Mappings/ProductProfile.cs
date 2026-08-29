using AutoMapper;
using MetraTC.Application.DTOs;
using MetraTC.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Text;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Mappings;

public class ProductProfile : Profile
{
    public ProductProfile()
    {
        CreateMap<Product, ProductDto>()
            .ForMember(d => d.IsSoldByWeight, o => o.MapFrom(s => s.IsSoldByWeight));

        CreateMap<CreateProductDto, Product>()
            .ConstructUsing(dto => new Product(dto.Sku, dto.Name, dto.Price, dto.Barcode, dto.Description, dto.ImageUrl, dto.Unit, dto.MinStock));
    }
}
