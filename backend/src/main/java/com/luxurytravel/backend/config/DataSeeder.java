package com.luxurytravel.backend.config;

import com.luxurytravel.backend.category.Category;
import com.luxurytravel.backend.category.CategoryRepository;
import com.luxurytravel.backend.destination.Destination;
import com.luxurytravel.backend.destination.DestinationRepository;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.User;
import com.luxurytravel.backend.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@Configuration
public class DataSeeder {
    @Bean
    CommandLineRunner seedData(
            DestinationRepository destinationRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            if (userRepository.count() == 0) {
                userRepository.save(new User("admin", "admin@luxurytravel.com", passwordEncoder.encode("admin123"), "System Admin", Role.ADMIN));
                userRepository.save(new User("seller", "seller@luxurytravel.com", passwordEncoder.encode("seller123"), "Travel Seller", Role.SELLER));
                userRepository.save(new User("user", "user@luxurytravel.com", passwordEncoder.encode("user123"), "Normal User", Role.USER));
            }
            if (categoryRepository.count() == 0) {
                categoryRepository.save(new Category("Stays", "https://cdn-icons-png.flaticon.com/512/25/25694.png", false));
                categoryRepository.save(new Category("Experiences", "https://cdn-icons-png.flaticon.com/512/3173/3173067.png", true));
                categoryRepository.save(new Category("Services", "https://cdn-icons-png.flaticon.com/512/1005/1005141.png", true));
            }

            if (destinationRepository.count() > 0) {
                return;
            }

            destinationRepository.save(build(
                    "Santorini Escape",
                    "Santorini, Greece",
                    "Ocean-view villas, Oia sunsets, local culinary experiences, and private yacht tours.",
                    new BigDecimal("1299.00"),
                    5,
                    "https://images.unsplash.com/photo-1504512485720-7d83a16ee930?auto=format&fit=crop&w=1400&q=80",
                    java.util.List.of("https://www.youtube.com/watch?v=kYJ5B32-9sI", "https://www.youtube.com/watch?v=R2_Mn-qffMA")
            ));
            destinationRepository.save(build(
                    "Kyoto Heritage",
                    "Kyoto, Japan",
                    "Explore ancient temples, Gion district, tea ceremonies, and seasonal sakura viewing.",
                    new BigDecimal("1499.00"),
                    6,
                    "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=1400&q=80",
                    java.util.List.of("https://www.youtube.com/watch?v=FjU_x1106pg", "https://www.youtube.com/watch?v=bO9oOQzG748")
            ));
            destinationRepository.save(build(
                    "Swiss Alps Luxury",
                    "Zermatt, Switzerland",
                    "Glacier Express train experience, chalet stays, and private snow mountain tours.",
                    new BigDecimal("2199.00"),
                    7,
                    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80",
                    java.util.List.of("https://www.youtube.com/watch?v=zO1sK55Ww9I", "https://www.youtube.com/watch?v=o0hX3kHXYlY")
            ));
            destinationRepository.save(build(
                    "Bali Wellness Retreat",
                    "Ubud, Bali, Indonesia",
                    "Yoga, spa, private villas, and healthy culinary journeys in lush nature.",
                    new BigDecimal("999.00"),
                    4,
                    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80",
                    java.util.List.of("https://www.youtube.com/watch?v=mY8Qe4zQZkI", "https://www.youtube.com/watch?v=vV_X1106pg")
            ));
        };
    }

    private Destination build(String name, String location, String desc, BigDecimal price, int days, String img, java.util.List<String> videoUrls) {
        return new Destination(name, location, desc, price, days, img, videoUrls);
    }
}
