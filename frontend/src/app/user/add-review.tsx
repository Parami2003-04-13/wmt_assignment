import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StarRating from '../../components/StarRating';
import api, { getStoredUser } from '../../services/api';
import { ensureRemoteImageUrl } from '../../services/uploadImage';

const CreateReviewScreen = () => {
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [mealName, setMealName] = useState<string>('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a review image.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      if (result.assets[0].base64) {
        setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      } else if (result.assets[0].uri) {
        setImage(result.assets[0].uri);
      }
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchMealDetails();
  }, [mealId]);

  const fetchMealDetails = async () => {
    if (!mealId) return;
    try {
      const res = await api.get(`/meals/${mealId}`);
      if (res.data?.name) {
        setMealName(res.data.name);
      }
    } catch (err) {
      console.log('Error fetching meal details:', err);
    }
  };

  const fetchReviews = async () => {
    if (!mealId) return;
    setFetching(true);
    try {
      const [reviewsRes, user] = await Promise.all([
        api.get(`/reviews/meal/${mealId}`),
        getStoredUser()
      ]);

      const allReviews = Array.isArray(reviewsRes.data) ? reviewsRes.data : [];
      setReviews(allReviews);

      if (user) {
        const userId = typeof user === 'string' ? user : (user.id || user._id);
        const myReview = allReviews.find((r: any) => {
          const rUserId = r.user?._id || r.user?.id || r.user;
          return String(rUserId) === String(userId);
        });
        
        if (myReview) {
          setIsEditing(true);
          setReviewId(myReview._id);
          setRating(myReview.rating);
          setComment(myReview.comment);
          setImage(myReview.image || null);
        }
      }
    } catch (err) {
      console.log('Error fetching reviews:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Required', 'Please select a star rating.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Required', 'Please write a comment.');
      return;
    }

    setLoading(true);
    try {
      const trimmedReviewImage = typeof image === 'string' ? image.trim() : '';
      let imageForApi: string | null = trimmedReviewImage || null;
      if (imageForApi) {
        try {
          imageForApi = await ensureRemoteImageUrl(imageForApi, 'reviews');
        } catch (uploadErr: any) {
          console.error(uploadErr);
          Alert.alert(
            'Upload failed',
            uploadErr?.response?.data?.message ||
              uploadErr?.message ||
              'Could not upload the review photo.'
          );
          setLoading(false);
          return;
        }
      } else {
        imageForApi = null;
      }

      if (isEditing && reviewId) {
        await api.put(`/reviews/${reviewId}`, {
          rating,
          comment: comment.trim(),
          image: imageForApi,
        });
        await fetchReviews();
        Alert.alert('Success', 'Your review has been updated!', [
          { text: 'OK' },
        ]);
      } else {
        await api.post('/reviews', {
          meal: mealId,
          rating,
          comment: comment.trim(),
          image: imageForApi,
        });
        await fetchReviews();
        Alert.alert('Success', 'Thank you for your review!', [
          { text: 'OK' },
        ]);
      }
    } catch (error: any) {
      console.log('Review submission error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || 'Failed to submit review. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!reviewId) return;

    const performDelete = async () => {
      setLoading(true);
      try {
        await api.delete(`/reviews/${reviewId}`);
        Alert.alert('Deleted', 'Your review has been removed.');
        setIsEditing(false);
        setReviewId(null);
        setRating(0);
        setComment('');
        setImage(null);
        fetchReviews();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete review.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to remove your review?')) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Review', 'Are you sure you want to remove your review?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.mealHeaderName}>{mealName}</Text>
        <Text style={styles.title}>{isEditing ? 'Update Review' : 'Rate your Meal'}</Text>
        <Text style={styles.subtitle}>{isEditing ? 'Need to change something?' : 'How was your experience?'}</Text>

        <View style={styles.ratingSection}>
          <StarRating rating={rating} onRatingChange={setRating} />
          <Text style={styles.ratingText}>
            {rating > 0 ? `${rating} / 5 Stars` : 'Select a rating'}
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Your Review</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell others what you thought about this meal..."
            placeholderTextColor="#95a5a6"
            multiline
            numberOfLines={5}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.imageUploadSection}>
          <Text style={styles.label}>Add a Photo (Optional)</Text>
          {image ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="contain" />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadImageBtn} onPress={pickImage}>
              <MaterialCommunityIcons name="camera-plus" size={24} color="#7f8c8d" />
              <Text style={styles.uploadImageText}>Upload Image</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
                {isEditing ? 'Save Changes' : 'Submit Review'}
            </Text>
          )}
        </TouchableOpacity>

        {isEditing && (
            <TouchableOpacity
                style={[styles.deleteButton, loading && styles.disabledButton]}
                onPress={handleDelete}
                disabled={loading}
            >
                <Text style={styles.deleteButtonText}>Delete Review</Text>
            </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <View style={styles.reviewsListSection}>
            <Text style={styles.reviewsListTitle}>Community Reviews</Text>
            {fetching ? (
                <ActivityIndicator color="#2ecc71" style={{ marginTop: 20 }} />
            ) : reviews.length === 0 ? (
                <View style={styles.noReviewsCard}>
                    <Text style={styles.noReviewsText}>No reviews yet. Be the first to share your thoughts!</Text>
                </View>
            ) : (
                reviews.map((r) => (
                    <View key={r._id} style={styles.reviewCard}>
                        <View style={styles.reviewCardHeader}>
                            <Text style={styles.reviewerName}>{r.user?.name || 'Anonymous'}</Text>
                            <StarRating rating={r.rating} size={16} readonly />
                        </View>
                        <Text style={styles.reviewCardComment}>{r.comment}</Text>
                        {r.image ? (
                            <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreenImage(r.image)}>
                                <Image source={{ uri: r.image }} style={styles.reviewCardImage} resizeMode="contain" />
                            </TouchableOpacity>
                        ) : null}
                        <Text style={styles.reviewCardDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </View>
                ))
            )}
        </View>
      </ScrollView>

      {/* Fullscreen Image Modal */}
      <Modal visible={!!fullscreenImage} transparent={true} animationType="fade">
          <View style={styles.fullscreenContainer}>
              <TouchableOpacity 
                style={styles.fullscreenCloseBtn} 
                onPress={() => setFullscreenImage(null)}
              >
                  <MaterialCommunityIcons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              {fullscreenImage && (
                  <Image 
                    source={{ uri: fullscreenImage }} 
                    style={styles.fullscreenImage} 
                    resizeMode="contain" 
                  />
              )}
          </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 15,
  },
  ratingText: {
    marginTop: 5,
    fontSize: 14,
    color: '#34495e',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  deleteButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    borderColor: '#95a5a6',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
      height: 1,
      backgroundColor: '#f1f2f6',
      marginVertical: 40,
  },
  reviewsListSection: {
      marginBottom: 20,
  },
  reviewsListTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 20,
  },
  reviewCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#f1f2f6',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
  },
  reviewCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
  },
  reviewerName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#2c3e50',
  },
  reviewCardComment: {
      fontSize: 15,
      color: '#576574',
      lineHeight: 22,
      marginBottom: 12,
  },
  reviewCardImage: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: 12,
      backgroundColor: '#f1f2f6',
  },
  reviewCardDate: {
      fontSize: 12,
      color: '#95a5a6',
  },
  noReviewsCard: {
      padding: 30,
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
  },
  noReviewsText: {
      color: '#95a5a6',
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 20,
  },
  imageUploadSection: {
    marginBottom: 30,
  },
  uploadImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  uploadImageText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f2f6',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  mealHeaderName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2ecc71',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: -10,
  }
});

export default CreateReviewScreen;