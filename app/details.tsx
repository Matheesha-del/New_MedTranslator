import { Stack, useLocalSearchParams } from 'expo-router';
import { Text , View, TextInput, Button}from 'react-native';
import {supabase} from '~/utils/supabase';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useState} from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Container } from '~/components/Container';
import { ScreenContent } from '~/components/ScreenContent';


export default function Details() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [recording, setRecording] = useState<Audio.Recording>();

  const [permissionResponse, requestPermission] = Audio.usePermissions();

  
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

  const translate = async (text: string) => {
    const { data,error } = await supabase.functions.invoke('trmed', {
      body: JSON.stringify({ input, from: 'English', to: 'Spanish'}),
    });
    console.log(error);
    console.log(data);

    return data?.content || 'Something went wrong!';
  }

  const onTranslate = async () => {
    const translation = await translate(input);
    setOutput(translation);

  };

  async function startRecording() {
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
      setRecording(recording);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (!recording){
      return;
    }
    console.log('Stopping recording..');
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync(
      {
        allowsRecordingIOS: false,
      }
    );
    const uri = recording.getURI();
    console.log('Recording stopped and stored at', uri);

    if(uri){
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64'});
      const { data, error } = await supabase.functions.invoke('speech-to-text',{
        body: JSON.stringify({ audioBase64 }),
      });
      setInput(data.text);
      const translation = await translate(data.text);
      setOutput(translation);
      console.log(data);
      console.log(error);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Communication Box' }} />
      {/*Language Selector row*/}
      <View className="justify-around p-5" >
         <Text className="font-semibold colour-blue-800">English</Text>
         <FontAwesome5 name="arrows-alt-h" size={24} color="black" />
         <Text className="font-semibold colour-blue-800">Tamil</Text>
      </View>

      {/*Input Container*/}
      <View className="border-y border-gray-300 p-5">

        <View className="flex-column gap-5">
          {/*input*/}
          <TextInput
          value={input}
          onChangeText={setInput} 
          placeholder="Enter your text" 
          className="min-h-32 text-lg" 
          multiline
          maxLength={5000}/>
          {/*send button*/}
          <FontAwesome6 onPress={onTranslate} name="circle-arrow-right" size={24} color="royalblue" />
        </View>

        <View className="flex-row justify-between">
          {recording ? (
            <FontAwesome5 onPress={stopRecording} name="stop-circle" size={24} color="royalblue" />
          ) : (<FontAwesome6 onPress={startRecording} name="microphone" size={18} color="dimgray" />

          )}
          <Text className="color-gray-500">{input.length} / 5000</Text>
        </View>
      </View>
    
      {/*output container*/}
      {output && (
      <View className="gap-5 p-5 bg-gray-300">
        <Text className="min-h-32 text-lg">{output}</Text>
        <View className="flex-row justify-between">
          <FontAwesome6 onPress={() => textToSpeech(output)}
            name="volume-high" size={18} color="dimgray" />
          <FontAwesome5 name="copy" size={18} color="dimgray" />
        </View>
      </View>
      )}

      <Button title="Record mic" />
      <Button title="Record patient" />
      <Button title="Submit the report" />
      <Button title="Print" />




    </>
  );
}
