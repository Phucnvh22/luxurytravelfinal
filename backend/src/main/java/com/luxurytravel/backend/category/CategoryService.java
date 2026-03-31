package com.luxurytravel.backend.category;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<Category> findAll() {
        return categoryRepository.findAll();
    }

    public Category findById(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new CategoryNotFoundException(id));
    }

    @Transactional
    public Category create(CategoryUpsertRequest request) {
        Category category = new Category();
        category.setName(request.getName());
        category.setIconUrl(request.getIconUrl());
        category.setNewFeature(request.isNewFeature());
        return categoryRepository.save(category);
    }

    @Transactional
    public Category update(Long id, CategoryUpsertRequest request) {
        Category category = findById(id);
        category.setName(request.getName());
        category.setIconUrl(request.getIconUrl());
        category.setNewFeature(request.isNewFeature());
        return categoryRepository.save(category);
    }

    @Transactional
    public void delete(Long id) {
        if (!categoryRepository.existsById(id)) {
            throw new CategoryNotFoundException(id);
        }
        categoryRepository.deleteById(id);
    }
}
