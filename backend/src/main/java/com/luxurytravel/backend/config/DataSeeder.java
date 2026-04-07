package com.luxurytravel.backend.config;

import com.luxurytravel.backend.category.Category;
import com.luxurytravel.backend.category.CategoryRepository;
import com.luxurytravel.backend.destination.Destination;
import com.luxurytravel.backend.destination.DestinationRepository;
import com.luxurytravel.backend.experience.Experience;
import com.luxurytravel.backend.experience.ExperienceRepository;
import com.luxurytravel.backend.service.TravelService;
import com.luxurytravel.backend.service.TravelServiceRepository;
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
            TravelServiceRepository travelServiceRepository,
            ExperienceRepository experienceRepository,
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

            if (travelServiceRepository.count() == 0) {
                travelServiceRepository.save(new TravelService(
                        "Private Car",
                        "Door-to-door transfers with a professional driver. Flexible pick-up times and premium vehicles.",
                        new BigDecimal("79.00"),
                        "https://images.unsplash.com/photo-1550353127-b0da3aeaa0ca?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
                ));
                travelServiceRepository.save(new TravelService(
                        "Breakfast",
                        "Daily breakfast add-on with dietary options. Great for early departures and relaxed mornings.",
                        new BigDecimal("15.00"),
                        "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=ysz5S6PUM-U")
                ));
                travelServiceRepository.save(new TravelService(
                        "Tour Guide",
                        "Local experts for private city tours, cultural experiences, and tailored itineraries.",
                        new BigDecimal("120.00"),
                        "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=YE7VzlLtp-4")
                ));
            }

            if (experienceRepository.count() == 0) {
                experienceRepository.save(new Experience(
                        "Hot Air Balloon Ride",
                        "A scenic flight with a private pilot and pickup. Ideal for sunrise views and special occasions.",
                        new BigDecimal("299.00"),
                        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
                ));
                experienceRepository.save(new Experience(
                        "Private Cooking Class",
                        "Hands-on local cuisine with a chef at your villa. Includes ingredients and tasting course.",
                        new BigDecimal("159.00"),
                        "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=ysz5S6PUM-U")
                ));
                experienceRepository.save(new Experience(
                        "Sunset Yacht Cruise",
                        "A curated route with drinks and light bites included. Private crew and flexible timing.",
                        new BigDecimal("499.00"),
                        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80",
                        java.util.List.of("https://www.youtube.com/watch?v=YE7VzlLtp-4")
                ));
            }

            if (!destinationRepository.existsByNameIgnoreCase("Da Nang Discovery")) {
                destinationRepository.save(build(
                        "Da Nang Discovery",
                        "Da Nang, Vietnam",
                        "From the Dragon Bridge to Son Tra Peninsula and beach sunsets — a modern coastal city with unforgettable views.",
                        new BigDecimal("799.00"),
                        4,
                        "https://commons.wikimedia.org/wiki/Special:FilePath/Da%20Nang%20Bay%201.jpg?width=1600",
                        java.util.List.of()
                ));
            }

            if (!destinationRepository.existsByNameIgnoreCase("Da Nang Night Lights")) {
                destinationRepository.save(build(
                        "Da Nang Night Lights",
                        "Da Nang, Vietnam",
                        "City lights, riverside walks, and the iconic Dragon Bridge — designed for travelers who love night scenes.",
                        new BigDecimal("699.00"),
                        3,
                        "https://commons.wikimedia.org/wiki/Special:FilePath/Da_Nang_Dragon_Bridge_(I).jpg?width=1600",
                        java.util.List.of()
                ));
            }

            if (!destinationRepository.existsByNameIgnoreCase("Marble Mountains Retreat")) {
                destinationRepository.save(build(
                        "Marble Mountains Retreat",
                        "Da Nang, Vietnam",
                        "Explore the Marble Mountains with caves, pagodas, and viewpoints — a peaceful cultural escape near the coast.",
                        new BigDecimal("649.00"),
                        3,
                        "https://commons.wikimedia.org/wiki/Special:FilePath/Marble_Mountain_Gate,_Da_Nang.jpg?width=1600",
                        java.util.List.of()
                ));
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
