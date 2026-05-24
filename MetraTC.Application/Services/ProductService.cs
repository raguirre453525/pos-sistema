using AutoMapper;
using MetraTC.Domain.Entities;
using MetraTC.Domain.Interfaces; // Asumiendo que tienes IRepository<T> igual que el sistema médico
using System.Threading.Tasks;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services;

public class ProductService : IProductService
{
    private readonly IRepository<Product> _repository;
    private readonly IMapper _mapper;

    public ProductService(IRepository<Product> repository, IMapper mapper)
    {
        _repository = repository;
        _mapper = mapper;
    }

    public async Task<ProductDto> CreateAsync(CreateProductDto createProductDto)
    {
        var product = _mapper.Map<Product>(createProductDto);
        await _repository.AddAsync(product);

        return _mapper.Map<ProductDto>(product);
    }
}