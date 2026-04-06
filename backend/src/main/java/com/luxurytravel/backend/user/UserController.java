package com.luxurytravel.backend.user;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<User> getAll() {
        return userService.findAll();
    }

    @GetMapping("/sellers")
    public List<User> getSellers() {
        return userService.findSellers();
    }

    @PostMapping("/sellers/{id}/pay")
    public User paySeller(@PathVariable Long id) {
        return userService.paySeller(id);
    }

    @GetMapping("/{id}")
    public User getById(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public User create(@RequestBody @Valid UserCreateRequest request) {
        return userService.create(request);
    }

    @PutMapping("/{id}")
    public User update(@PathVariable Long id, @RequestBody @Valid UserUpdateRequest request) {
        return userService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
