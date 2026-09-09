package dev.unison.catalog;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CatalogController.class)
class CatalogControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CatalogService catalog;

    @Test void returnsPublicMetadataAndSameOriginMediaUrl() throws Exception {
        when(catalog.list()).thenReturn(List.of(new TrackDto("first-light", "First Light",
                "Unison Lab", "Ambient", 60, "/media/demo/first-light.wav", "sunrise")));
        mvc.perform(get("/api/tracks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("First Light"))
                .andExpect(jsonPath("$[0].audioUrl").value("/media/demo/first-light.wav"))
                .andExpect(jsonPath("$[0].audioKey").doesNotExist());
    }

    @Test void emptyCatalogReturnsAnArray() throws Exception {
        when(catalog.list()).thenReturn(List.of());
        mvc.perform(get("/api/tracks")).andExpect(status().isOk()).andExpect(content().json("[]"));
    }
}
