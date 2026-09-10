package dev.unison.ingestion;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AudioProcessorTest {
    @Test void acceptsSingleAudioStreamWithBoundedDuration() {
        assertThat(AudioProcessor.validateProbe("codec_type=audio\nduration=2.500000\n")).isEqualTo(2.5);
    }

    @Test void rejectsCoverArtMultipleStreamsAndMissingAudio() {
        for (String text : new String[] {"codec_type=audio\ncodec_type=video\nduration=2", "codec_type=audio\ncodec_type=audio\nduration=2", "duration=2"})
            assertThatThrownBy(() -> AudioProcessor.validateProbe(text)).isInstanceOf(AudioProcessor.InvalidAudio.class);
    }

    @Test void rejectsUnknownNonFiniteAndOutOfRangeDuration() {
        for (String duration : new String[] {"N/A", "NaN", "Infinity", "0.9", "601", "-1"})
            assertThatThrownBy(() -> AudioProcessor.validateProbe("codec_type=audio\nduration=" + duration))
                    .isInstanceOf(AudioProcessor.InvalidAudio.class);
    }
}
