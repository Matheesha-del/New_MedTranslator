import { Stack, useLocalSearchParams } from 'expo-router';
import { Platform, Text , View, TextInput, Button, ScrollView, StyleSheet, TouchableOpacity, Modal, Alert}from 'react-native';
import {supabase} from '~/utils/supabase';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, useRef, useEffect} from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
//import { Container } from '~/components/Container';
//import { ScreenContent } from '~/components/ScreenContent';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';


let conversationArray: string[] = [];


export default function Details() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryText, setSummaryText]= useState('');
  const [doctorRecording, setDoctorRecording] = useState<Audio.Recording>();
  const [patientRecording, setPatientRecording] = useState<Audio.Recording>();
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const scrollViewRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  
  const textToSpeech = async (text: string) =>{
    const { data,error } = await supabase.functions.invoke('text-to-speech',{
      body: JSON.stringify({ input:text }),
    });
    console.log(error);
    console.log(data);
    if (data)
    {
      const {sound} = await Audio.Sound.createAsync({
        uri: `data:audio/mp3;base64,${data.mp3Base64}`,
      });
      sound.playAsync();
    }
  };

  // Append new messages to conversation and save to file
  const addMessage = (speaker: 'Doctor' | 'Patient', text: string) => {
    const newConversation = [...conversation, { speaker, text }];
    setConversation(newConversation);

    // Auto-scroll to the bottom
    scrollViewRef.current?.scrollToEnd({ animated: true });

   
  };


  const translateET = async (text :string) => {
    const { data, error } = await supabase.functions.invoke('trmed', {
      body: JSON.stringify({ input: text, from: 'English', to: 'Tamil' }),
    });

    return data?.content || 'Translation failed.';
  };

  const onTranslateET = async () => {
    const translation = await translateET(input);
    setOutput(translation);
  };

  const translateTE = async (text :string) => {
    const { data, error } = await supabase.functions.invoke('trmed', {
      body: JSON.stringify({ input: text, from: 'Tamil', to: 'English' }),
    });

    return data?.content || 'Translation failed.';
  };


  const onTranslateTE = async () => {
    const translation = await translateTE(input);
    setOutput(translation);
  };

 
  
  const summarize = async (conversation: string) => { 
    const { data,error } = await supabase.functions.invoke('summarize', {
      body: JSON.stringify({conversation}),
    });
    console.log(error);
    console.log(data);
    return data?.summary || 'Something went wrong!';
  }

  const onSummarize = async () => {
    const singleConversation = conversationArray.join('<***>');
    console.log(singleConversation);
    try{
    const summary = await summarize(singleConversation);
    console.log(summary);
    setSummaryText(summary);
    setSummaryModalVisible(true);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }

  };

  const html = `
<html>
  <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; text-align:center;}
            p { margin: 10px 0;text-align:center; }
          </style>
        </head>
        <body>
          <h1>Summary of the Conversation</h1>
          <p>${summaryText.replace(/\n/g, '<br>')}</p>
          <br><br>
          <p>Doctor's Signature: ______________</p>
          <p>Patient's Signature: ______________</p>
        </body>
</html>
`;

const print = async () => {
  try {
    await Print.printAsync({
      html,
      ...(Platform.OS === 'ios' && selectedPrinter
        ? { printerUrl: selectedPrinter.url }
        : {}),
    });
  } catch (error) {
    console.error('Error during printing:', error);
  }
};

const printToFile = async () => {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    console.log('File has been saved to:', uri);
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Error during print to file:', error);
  }
};

{/*const selectPrinter = async () => {
  if (Platform.OS === 'ios') {
    try {
      const printer = await Print.selectPrinterAsync();
      setSelectedPrinter(printer);
    } catch (error) {
      console.error('Error selecting printer:', error);
    }
  } else {
    console.warn('Select printer is not available on Android.');
  }
};*/}

  const handlePrint = () => {
    
    Alert.alert(
      'Print Confirmation',
      'Are you sure you want to close the summary? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: () => {
            setSummaryModalVisible(false);
            setIsPrinting(false);
            setConversation([]);
          },
        }, 
      ]
      );
      
    };

  async function startDoctorRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setDoctorRecording(recording);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopDoctorRecording() {
    if (!doctorRecording){
      return;
    }
    console.log('Stopping recording..');
    setDoctorRecording(undefined);
    await doctorRecording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync(
      {
        allowsRecordingIOS: false,
      }
    );
    const uri = doctorRecording.getURI();
    console.log('Recording stopped and stored at', uri);

    if(uri){
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64'});
      const { data, error } = await supabase.functions.invoke('speech-to-text',{
        body: JSON.stringify({ audioBase64 }),
      });
      //setInput(data.text);
      if (data?.text) {
        addMessage('Doctor', data.text);
      }

      const translation = await translateET(data.text);
      textToSpeech(translation);

      console.log('Before:', conversationArray);
      conversationArray.push(data.text);
      console.log('After:', conversationArray);

      console.log(data);
      console.log(error);
    }}

    async function startPatientRecording() {
      try {
        if (permissionResponse?.status !== 'granted') {
          console.log('Requesting permission..');
          await requestPermission();
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
  
        console.log('Starting recording..');
        const { recording } = await Audio.Recording.createAsync( Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setPatientRecording(recording);
        console.log('Recording started');
      } catch (err) {
        console.error('Failed to start recording', err);
      }
    }
  
    async function stopPatientRecording() {
      if (!patientRecording){
        return;
      }
      console.log('Stopping recording..');
      setPatientRecording(undefined);
      await patientRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync(
        {
          allowsRecordingIOS: false,
        }
      );
      const uri = patientRecording.getURI();
      console.log('Recording stopped and stored at', uri);
  
      if(uri){
        const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64'});
        const { data, error } = await supabase.functions.invoke('speech-to-text',{
          body: JSON.stringify({ audioBase64 }),
        });
        //setInput(data.text);
        
        if (data?.text) {
          
          const translation = await translateTE(data.text);
          addMessage('Patient', translation);
          console.log('Before:', conversationArray);
          conversationArray.push(translation);
          console.log('After:', conversationArray);
        }
        console.log(data);
        console.log(error);
      }}

         
  

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tamil-English Translator</Text>
      <ScrollView style={styles.outputArea} ref={scrollViewRef}>
        {conversation.map((line, index) => (
          <View key={index} 
          style={[styles.messageContainer,
          line.speaker === 'Patient' && styles.patientMessage,
          line.speaker === 'Doctor' && styles.doctorMessage,]}>
            
            {
          line.speaker === 'Doctor' ? (
            <FontAwesome5 name="user-md" size={20} color="green" style={styles.icon} />
            ) : (
            <FontAwesome5 name="user-alt" size={20} color="blue" style={styles.icon} />
            )
          }

          
          <Text style={styles.outputText}>
          <View style={styles.textContainer}>
            <Text style={styles.outputText}>{line.text}</Text>
            </View>
           
          </Text>
        </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button1}
          onPress={() => {
            setCurrentSpeaker('Doctor');
            if (doctorRecording) {
              stopDoctorRecording();
            } else {
              startDoctorRecording();
            }
          }}
        >
          <FontAwesome5
            name={doctorRecording ? 'stop' : 'microphone'}
            size={24}
            color={doctorRecording ? 'red' : 'green'}
          />
          <Text style={styles.buttonLabel1}>Doctor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button2}
          onPress={() => {
            setCurrentSpeaker('Patient');
          if (patientRecording) {
            stopPatientRecording();
          } else {
            startPatientRecording();
          }
        }}
        >
          <FontAwesome5
            name={patientRecording ? 'stop' : 'microphone'}
            size={24}
            color={patientRecording ? 'red' : 'blue'}
          />
          <Text style={styles.buttonLabel2}>Patient</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button2} onPress={onSummarize}>
          <FontAwesome5 name="file-import" size={30} color="#FF9800" />
          <Text style={styles.buttonLabel3}>Summarize</Text>
        </TouchableOpacity>
      </View>
       {/* Summary Modal */}
       <Modal
        animationType="slide"
        transparent={true}
        visible={summaryModalVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.summaryHeader}>Summary of the Conversation</Text>
            <Text style={styles.summaryText}>{summaryText}</Text>
            <View style={styles.signatureContainer}>
              <Text>Doctor's Signature: ______________</Text>
              <Text></Text>
              <Text>Patient's Signature: ______________</Text>
            </View>
            <View style={styles.rowContainer}>
              <TouchableOpacity style={styles.button2} onPress={print}>
              <MaterialCommunityIcons name="printer" size={28} color="#6495ed" />            
              <Text style={styles.buttonLabel4}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spacer} onPress={printToFile}>
              <FontAwesome5 name="file-download" size={24} color="#6495ed" />
              <Text style={styles.buttonLabel4}>Print to PDF File</Text>
              </TouchableOpacity> 
             
            </View> 
            <TouchableOpacity style={styles.closeButton} onPress={handlePrint}>
              <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
        </View>  
          </View>   
      
       
      </Modal>
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
  
  textContainer: {
    backgroundColor: '#f1f1f1', // Light gray background for text
    borderRadius: 8,  // Rounded corners for the background
    paddingHorizontal: 10,  // Horizontal padding to create space around text
    paddingVertical: 8,  // Vertical padding for better spacing
    marginRight:4,
    marginLeft:4,
  },
  patientMessage: {
    flexDirection: 'row-reverse', // Align patient messages to the right
    marginRight:2,
    //justifyContent: 'flex-start',
  },
  doctorMessage: {
    flexDirection: 'row', // Align patient messages to the right
    marginLeft:2,
    //justifyContent: 'flex-start',
  },
  icon: {
    marginHorizontal:5,
    
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: 10, // Padding for doctor messages
    marginRight: 10, 
    paddingHorizontal: 10,// Padding for both messages
        
  },
  outputArea: {
    
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
    borderRadius: 8, 
  },
  button1:{
    alignItems: 'center',
    justifyContent: 'center',
  },
  button2:{
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel1: {
    color: 'green',
    fontSize: 16,
    },  
  buttonLabel2: {
    color: 'blue',
    fontSize: 16,
  },
  buttonLabel3: {
    color: '#FF9800',
    fontSize: 16,
  },
  buttonLabel4: {
    color: '#6495ed',
    fontSize: 16,
  },
  spacer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'crimson',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    flex:1,
    color: 'white',
    fontSize: 16,
    textAlign:'center',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Adjust spacing between buttons
    alignItems: 'center', // Align vertically
    paddingHorizontal: 10, // Optional: add some horizontal padding
  },
  printer: {
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  summaryHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'justify',
  },
  signatureContainer: {
    marginBottom: 20,
  },
});
