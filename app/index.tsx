import React from 'react';
import { StyleSheet, View, Text, ImageBackground } from 'react-native';
import { Button } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { Link } from 'expo-router';
import { Stack } from 'expo-router';



export default function Home() {
  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      
      <ImageBackground
        source={require('../assets/background.jpg')}
        style={styles.container}
      >

        {/* Lottie Animation */}
        <LottieView
          source={require('../assets/Main Scene.json')} 
          autoPlay
          loop
          style={styles.animation}
          speed={0.2}
        />
        
        {/* Welcome Text */}
        <Text style={[styles.title, { fontFamily: 'monospace' }]}>
  MedTranslator</Text>
        <Text style={[styles.subtitle, { fontStyle: 'italic' }]}>
          Bridging the gap between doctors and patients.
        </Text>

        {/* Button with Navigation */}
        <Link href={{ pathname: '/details', params: { name: 'Dan' } }} asChild>
          <Button
            mode="contained"
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            Get Started
          </Button>
        </Link>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 20,
  },
  animation: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#37474F',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#607D8B',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#64edd3',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700', 
    color: '#1c2a43',
    fontFamily: 'monospace',
  },
});
