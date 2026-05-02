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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import StarRating from '../../components/StarRating';
import api, { getStoredUser } from '../../services/api';

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

  useEffect(() => {
    fetchReviews();
  }, [mealId]);

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
      if (isEditing && reviewId) {
        await api.put(`/reviews/${reviewId}`, {
          rating,
          comment: comment.trim(),
        });
        Alert.alert('Success', 'Your review has been updated!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await api.post('/reviews', {
          meal: mealId,
          rating,
          comment: comment.trim(),
        });
        Alert.alert('Success', 'Thank you for your review!', [
          { text: 'OK', onPress: () => router.back() },
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
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                        <Text style={styles.reviewCardDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </View>
                ))
            )}
        </View>
      </ScrollView>
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
  }
});

export default CreateReviewScreen;