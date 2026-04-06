package com.luxurytravel.backend.user;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public List<User> findSellers() {
        return userRepository.findByRole(Role.SELLER);
    }

    public User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }

    @Transactional
    public User paySeller(Long id) {
        User user = findById(id);
        if (user.getRole() != Role.SELLER) {
            throw new RuntimeException("User is not a seller");
        }
        user.setCommissionBalance(0.0);
        return userRepository.save(user);
    }

    @Transactional
    public User create(UserCreateRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username already exists");
        }

        User user = new User(
                request.getUsername(),
                request.getEmail(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName(),
                request.getRole()
        );

        if (request.getCommissionRate() != null) {
            user.setCommissionRate(request.getCommissionRate());
        }

        return userRepository.save(user);
    }

    @Transactional
    public User update(Long id, UserUpdateRequest request) {
        User user = findById(id);
        
        // If username changed, check if new username exists
        if (!user.getUsername().equals(request.getUsername()) && userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username already exists");
        }

        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setRole(request.getRole());
        
        // Update commission rate if provided
        if (request.getCommissionRate() != null) {
            user.setCommissionRate(request.getCommissionRate());
        }

        return userRepository.save(user);
    }

    @Transactional
    public void delete(Long id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException(id);
        }
        userRepository.deleteById(id);
    }
}
