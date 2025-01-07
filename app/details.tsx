import { Text, View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '~/utils/supabase';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function Details() {
  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [doctorRecording, setDoctorRecording] = useState<Audio.Recording | null>(null);
  const [patientRecording, setPatientRecording] = useState<Audio.Recording | null>(null);
  const scrollViewRef = useRef(null);

  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Load saved conversation from file on component mount
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const path = FileSystem.documentDirectory + 'conversation.txt';
        const fileExists = await FileSystem.getInfoAsync(path);

        if (fileExists.exists) {
          const content = await FileSystem.readAsStringAsync(path);
          setConversation(JSON.parse(content));
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      }
    };

    loadConversation();
  }, []);

  const textToSpeech = async (text) => {
    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: JSON.stringify({ input: text }),
    });

    if (data) {
      const { sound } = await Audio.Sound.createAsync({
        uri: `data:audio/mp3;base64,${data.mp3Base64}`,
      });
      sound.playAsync();
    }
  };

  const translateET = async (text) => {
    const { data, error } = await supabase.functions.invoke('trmed', {
      body: JSON.stringify({ input: text, from: 'English', to: 'Tamil' }),
    });

    return data?.content || 'Translation failed.';
  };

  const onTranslateTE = async () => {
    const translation = await translateET(input);
    setOutput(translation);
  };

  const translateTE = async (text) => {
    const { data, error } = await supabase.functions.invoke('trmed', {
      body: JSON.stringify({ input: text, from: 'Tamil', to: 'English' }),
    });

    return data?.content || 'Translation failed.';
  };

  const onTranslateET = async () => {
    const translation = await translateTE(input);
    setOutput(translation);
  };

  // Append new messages to conversation and save to file
  const addMessage = (speaker, text) => {
    const newConversation = [...conversation, { speaker, text }];
    setConversation(newConversation);

    // Auto-scroll to the bottom
    scrollViewRef.current?.scrollToEnd({ animated: true });

    // Save conversation to file
    const path = FileSystem.documentDirectory + 'conversation.txt';
    FileSystem.writeAsStringAsync(path, JSON.stringify(newConversation));
  };

  // Doctor recording handlers
  async function startDoctorRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        await requestPermission();
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setDoctorRecording(recording);
    } catch (err) {
      console.error('Failed to start doctor recording:', err);
    }
  }

  async function stopDoctorRecording() {
    if (!doctorRecording) return;

    await doctorRecording.stopAndUnloadAsync();
    const uri = doctorRecording.getURI();

    if (uri) {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: JSON.stringify({ audioBase64 }),
      });

      if (data?.text) {
        addMessage('Doctor', data.text);
        const translation = await translateET(data.text);
        addMessage('Doctor', translation);
      }
    }
    setDoctorRecording(null);
  }

  // Patient recording handlers
  async function startPatientRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        await requestPermission();
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setPatientRecording(recording);
    } catch (err) {
      console.error('Failed to start patient recording:', err);
    }
  }

  async function stopPatientRecording() {
    if (!patientRecording) return;

    await patientRecording.stopAndUnloadAsync();
    const uri = patientRecording.getURI();

    if (uri) {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: JSON.stringify({ audioBase64 }),
      });

      if (data?.text) {
        addMessage('Patient', data.text);
        const translation = await translateTE(data.text);
        addMessage('Patient', translation);
      }
    }
    setPatientRecording(null);
  }

  // Handle print summary
  const handlePrintSummary = async () => {
    try {
      const path = FileSystem.documentDirectory + 'conversation.txt';
      await FileSystem.deleteAsync(path); // Clear the conversation file
      setConversation([]); // Clear the in-memory conversation
      console.log('Conversation summary cleared.');
    } catch (err) {
      console.error('Failed to clear conversation:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tamil-English Translator</Text>
      <ScrollView style={styles.outputArea} ref={scrollViewRef}>
        {conversation.map((line, index) => (
          <Text key={index} style={styles.outputText}>
            {line.speaker}: {line.text}
          </Text>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={doctorRecording ? stopDoctorRecording : startDoctorRecording}
        >
          <FontAwesome5
            name={doctorRecording ? 'stop' : 'microphone'}
            size={24}
            color={doctorRecording ? 'red' : 'green'}
          />
          <Text>Doctor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={patientRecording ? stopPatientRecording : startPatientRecording}
        >
          <FontAwesome5
            name={patientRecording ? 'stop' : 'microphone'}
            size={24}
            color={patientRecording ? 'red' : 'blue'}
          />
          <Text>Patient</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handlePrintSummary}>
          <FontAwesome5 name="print" size={30} color="#FF9800" />
          <Text style={styles.buttonLabel}>Print</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'darkcyan',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#fff',
  },
  outputArea: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  outputText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#FF9800',
    fontSize: 16,
  },
});
