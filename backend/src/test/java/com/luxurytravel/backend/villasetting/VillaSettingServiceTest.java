package com.luxurytravel.backend.villasetting;

import com.luxurytravel.backend.room.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VillaSettingServiceTest {
    @Mock
    private VillaSettingRepository villaSettingRepository;
    @Mock
    private RoomRepository roomRepository;

    private VillaSettingService villaSettingService;

    @BeforeEach
    void setUp() {
        villaSettingService = new VillaSettingService(villaSettingRepository, roomRepository);
    }

    @Test
    void deleteBlocksRoomTypeWhenUsedByExistingVilla() {
        VillaSettingOption option = new VillaSettingOption();
        option.setId(7L);
        option.setCategory(VillaSettingCategory.ROOM_TYPE);
        option.setLabel("Garden View-Villa");

        when(villaSettingRepository.findById(7L)).thenReturn(Optional.of(option));
        when(roomRepository.existsByTypeIgnoreCase("Garden View-Villa")).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> villaSettingService.delete(7L));

        assertEquals(409, error.getStatusCode().value());
        assertEquals("Cannot delete this villa type because one or more villas are using it", error.getReason());
        verify(villaSettingRepository, never()).delete(option);
    }

    @Test
    void deleteAllowsRoomTypeWhenNoVillaUsesIt() {
        VillaSettingOption option = new VillaSettingOption();
        option.setId(8L);
        option.setCategory(VillaSettingCategory.ROOM_TYPE);
        option.setLabel("Unused Type");

        when(villaSettingRepository.findById(8L)).thenReturn(Optional.of(option));
        when(roomRepository.existsByTypeIgnoreCase("Unused Type")).thenReturn(false);

        villaSettingService.delete(8L);

        verify(villaSettingRepository).delete(option);
    }

    @Test
    void updateRenamesExistingVillaTypeAcrossRooms() {
        VillaSettingOption option = new VillaSettingOption();
        option.setId(9L);
        option.setCategory(VillaSettingCategory.ROOM_TYPE);
        option.setLabel("Garden View-Villa");

        com.luxurytravel.backend.room.Room room = new com.luxurytravel.backend.room.Room();
        room.setId(11L);
        room.setType("Garden View-Villa");
        room.setHost("Host A");

        VillaSettingUpsertRequest request = new VillaSettingUpsertRequest();
        request.setCategory(VillaSettingCategory.ROOM_TYPE);
        request.setLabel("Garden View Deluxe Villa");

        when(villaSettingRepository.findById(9L)).thenReturn(Optional.of(option));
        when(villaSettingRepository.existsByCategoryAndLabelIgnoreCaseAndIdNot(VillaSettingCategory.ROOM_TYPE, "Garden View Deluxe Villa", 9L))
                .thenReturn(false);
        when(villaSettingRepository.save(option)).thenReturn(option);
        when(roomRepository.findAllByTypeIgnoreCase("Garden View-Villa")).thenReturn(List.of(room));

        VillaSettingOption saved = villaSettingService.update(9L, request);

        assertEquals("Garden View Deluxe Villa", saved.getLabel());
        assertEquals("Garden View Deluxe Villa", room.getType());
        verify(roomRepository).saveAll(anyList());
    }
}
